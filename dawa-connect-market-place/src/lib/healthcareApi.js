import 'server-only';
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';

const state = globalThis.__healthcareApiState ||= { limits: new Map(), cache: new Map(), pending: new Map() };

export function apiError(message, status = 400) {
  return NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
}

// Best-effort single-instance protection. Use gateway/shared limits in production.
export function allowMapRequest(request, bucket = 'search', max = 40) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
  const key = `${bucket}:${createHash('sha256').update(address).digest('hex').slice(0, 24)}`;
  const now = Date.now();
  // This cap cannot be bypassed by changing client-supplied forwarding headers.
  const globalKey = `global:${bucket}`;
  let globalEntry = state.limits.get(globalKey);
  if (!globalEntry || globalEntry.expires <= now) { globalEntry = { count: 0, expires: now + 60000 }; state.limits.set(globalKey, globalEntry); }
  if (++globalEntry.count > (bucket === 'tiles' ? 1800 : 120)) return false;
  if (state.limits.size > 5000) for (const [id, entry] of state.limits) if (entry.expires <= now) state.limits.delete(id);
  if (!state.limits.has(key) && state.limits.size > 10000) return false;
  let entry = state.limits.get(key);
  if (!entry || entry.expires <= now) { entry = { count: 0, expires: now + 60000 }; state.limits.set(key, entry); }
  return ++entry.count <= max;
}

export async function cachedMapRequest(key, ttl, action) {
  const existing = state.cache.get(key);
  if (existing?.expires > Date.now()) return existing.value;
  if (state.pending.has(key)) return state.pending.get(key);
  const promise = Promise.resolve().then(action).then((value) => {
    if (state.cache.size >= 150) state.cache.delete(state.cache.keys().next().value);
    state.cache.set(key, { value, expires: Date.now() + ttl });
    return value;
  }).finally(() => state.pending.delete(key));
  state.pending.set(key, promise);
  return promise;
}

export function safeMapFailure(error) {
  return apiError(error?.code ? error.message : 'The map service is temporarily unavailable. Please try again.', error?.status || 503);
}

export function withMapDeadline(promise, milliseconds = 8000) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Map data timeout.')), milliseconds);
  })]).finally(() => clearTimeout(timer));
}
