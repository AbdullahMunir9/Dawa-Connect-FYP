import { app } from 'electron';

const PRODUCTION_API_BASE_URL = 'https://api.dawaconnect.store/api';
export const pharmacyApiBaseUrl = String(
  process.env.PHARMACY_API_BASE_URL || (app.isPackaged ? PRODUCTION_API_BASE_URL : 'http://localhost:5000/api'),
).replace(/\/$/, '');
export const pharmacyApiOrigin = new URL(pharmacyApiBaseUrl).origin;

let pharmacySessionToken = '';
let locationSessionId = '';

function endpoint(path) {
  return `${pharmacyApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function apiRequest(path, { method = 'GET', body, authenticated = true, timeout = 30_000 } = {}) {
  if (authenticated && !pharmacySessionToken) throw new Error('Your pharmacy session is missing. Sign in again.');
  let response;
  try {
    response = await fetch(endpoint(path), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(authenticated ? { Authorization: `Bearer ${pharmacySessionToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') throw new Error('The DawaConnect server took too long to respond.');
    throw new Error('Could not reach the DawaConnect server. Check your internet connection.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && authenticated) pharmacySessionToken = '';
    throw Object.assign(new Error(data.message || `Server request failed (${response.status}).`), { status: response.status });
  }
  return data;
}

async function apiPhotoRequest(path, buffer, mimeType, { authenticated = true, registrationToken = '' } = {}) {
  if (authenticated && !pharmacySessionToken) throw new Error('Your pharmacy session is missing. Sign in again.');
  let response;
  try {
    response = await fetch(endpoint(path), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': mimeType,
        ...(authenticated ? { Authorization: `Bearer ${pharmacySessionToken}` } : {}),
        ...(registrationToken ? { 'x-registration-photo-token': registrationToken } : {}),
      },
      body: buffer,
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') throw new Error('The pharmacy photo upload took too long.');
    throw new Error('Could not upload the pharmacy photo. Check your internet connection.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && authenticated) pharmacySessionToken = '';
    throw Object.assign(new Error(data.message || `Photo upload failed (${response.status}).`), { status: response.status });
  }
  return data;
}

export function getSessionToken() {
  return pharmacySessionToken;
}

export async function locationAvailable() {
  const data = await apiRequest('/pharmacy/location/config', { authenticated: false });
  return Boolean(data.configured);
}

export async function searchPharmacyLocation(text) {
  const data = await apiRequest('/pharmacy/location/search', {
    method: 'POST', authenticated: false, body: { text },
  });
  locationSessionId = data.sessionId || '';
  return Array.isArray(data.places) ? data.places : [];
}

export async function confirmPharmacyLocation(point) {
  if (!locationSessionId) throw new Error('Search for the pharmacy address first.');
  return apiRequest('/pharmacy/location/confirm', {
    method: 'POST', authenticated: false, body: { ...point, sessionId: locationSessionId },
  });
}

export async function checkRegistrationAvailability(payload) {
  return apiRequest('/pharmacy/auth/availability', { method: 'POST', authenticated: false, body: payload });
}

export async function registerUser(payload) {
  const data = await apiRequest('/pharmacy/auth/register', { method: 'POST', authenticated: false, body: payload });
  locationSessionId = '';
  return data;
}

export function verifyRegistration(payload) {
  return apiRequest('/pharmacy/auth/register/verify', { method: 'POST', authenticated: false, body: payload });
}

export function resendRegistrationOtp(challengeId) {
  return apiRequest('/pharmacy/auth/register/resend', {
    method: 'POST', authenticated: false, body: { challengeId },
  });
}

export function uploadRegistrationPhoto(slot, buffer, mimeType, registrationToken) {
  return apiPhotoRequest(`/pharmacy/auth/register/photos/${encodeURIComponent(slot)}`, buffer, mimeType, {
    authenticated: false, registrationToken,
  });
}

export async function loginUser(payload) {
  const data = await apiRequest('/pharmacy/auth/login', { method: 'POST', authenticated: false, body: payload });
  pharmacySessionToken = String(data.sessionToken || '');
  if (!pharmacySessionToken) throw new Error('The server did not create a pharmacy session.');
  return data;
}

export async function restoreUserSession({ sessionToken } = {}) {
  pharmacySessionToken = String(sessionToken || '').trim();
  const data = await apiRequest('/pharmacy/auth/me');
  return { ...data, sessionToken: pharmacySessionToken };
}

export async function logoutUser() {
  try {
    return await apiRequest('/pharmacy/auth/logout', { method: 'POST' });
  } finally {
    pharmacySessionToken = '';
  }
}

export async function requestPasswordReset(email) {
  return apiRequest('/pharmacy/auth/forgot-password', { method: 'POST', authenticated: false, body: { email } });
}

export async function resetPasswordWithOtp(payload) {
  return apiRequest('/pharmacy/auth/reset-password', { method: 'POST', authenticated: false, body: payload });
}

export function listProducts() {
  return apiRequest('/pharmacy/products');
}

export function createProduct(_ownerId, product) {
  return apiRequest('/pharmacy/products', { method: 'POST', body: product });
}

export function updateProduct(_ownerId, product) {
  const { id, _id, ...changes } = product || {};
  return apiRequest(`/pharmacy/products/${encodeURIComponent(id || _id)}`, { method: 'PATCH', body: changes });
}

export function removeProduct(_ownerId, id) {
  return apiRequest(`/pharmacy/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function getPharmacyAnalytics(month) {
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  return apiRequest(`/pharmacy/analytics${query}`);
}

export function listAnalyticsSnapshots() {
  return apiRequest('/pharmacy/analytics/snapshots');
}

export function finalizeAnalyticsSnapshot(month) {
  return apiRequest(`/pharmacy/analytics/snapshots/${encodeURIComponent(month)}`, { method: 'POST' });
}

export function getAnalyticsNarrative(month) {
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  return apiRequest(`/pharmacy/analytics/narrative${query}`);
}

export function generateAnalyticsNarrative(month, force = false) {
  return apiRequest('/pharmacy/analytics/narrative', {
    method: 'POST', body: { month, force }, timeout: 45_000,
  });
}

export function listCollection(entity) {
  return apiRequest(`/pharmacy/entities/${encodeURIComponent(entity)}`);
}

export function createCollectionItem(entity, _ownerId, item) {
  return apiRequest(`/pharmacy/entities/${encodeURIComponent(entity)}`, { method: 'POST', body: item });
}

export function updateCollectionItem(entity, _ownerId, id, updates) {
  return apiRequest(`/pharmacy/entities/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: updates });
}

export function removeCollectionItem(entity, _ownerId, id) {
  return apiRequest(`/pharmacy/entities/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function markAllNotificationsRead() {
  return apiRequest('/pharmacy/notifications/read-all', { method: 'PATCH' });
}

export function getProfile() {
  return apiRequest('/pharmacy/profile');
}

export function upsertProfile(_ownerId, profile) {
  return apiRequest('/pharmacy/profile', { method: 'PUT', body: profile });
}

export function uploadProfilePhoto(slot, buffer, mimeType) {
  return apiPhotoRequest(`/pharmacy/profile/photos/${encodeURIComponent(slot)}`, buffer, mimeType);
}

export function removeProfilePhoto(slot) {
  return apiRequest(`/pharmacy/profile/photos/${encodeURIComponent(slot)}`, { method: 'DELETE' });
}

export function listComplaints() {
  return apiRequest('/pharmacy/complaints');
}

export function createComplaint(_ownerId, complaint) {
  return apiRequest('/pharmacy/complaints', { method: 'POST', body: complaint });
}

export function replyComplaint(_ownerId, id, text) {
  return apiRequest(`/pharmacy/complaints/${encodeURIComponent(id)}/replies`, { method: 'POST', body: { text } });
}

export function updateComplaintStatus(_ownerId, id, status, note = '') {
  return apiRequest(`/pharmacy/complaints/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status, note } });
}

