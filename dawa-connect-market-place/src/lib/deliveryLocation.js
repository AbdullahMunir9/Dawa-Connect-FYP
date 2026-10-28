export const DELIVERY_LOCATION_STORAGE_KEY = 'dawaconnect_delivery_location';

export function normalizeDeliveryLocation(value) {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return {
    id: String(value?.id || 'selected-location').slice(0, 1000),
    label: String(value?.label || 'Selected delivery location').trim().slice(0, 600),
    line1: String(value?.line1 || value?.label || '').trim().slice(0, 200),
    area: String(value?.area || '').trim().slice(0, 100),
    city: String(value?.city || '').trim().slice(0, 100),
    province: String(value?.province || '').trim().slice(0, 100),
    postalCode: String(value?.postalCode || '').trim().slice(0, 30),
    latitude,
    longitude,
    source: value?.source === 'device' ? 'device' : 'entered',
  };
}

export function readDeliveryLocation() {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeDeliveryLocation(JSON.parse(localStorage.getItem(DELIVERY_LOCATION_STORAGE_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function saveDeliveryLocation(value) {
  const normalized = normalizeDeliveryLocation(value);
  if (typeof window !== 'undefined') {
    if (normalized) localStorage.setItem(DELIVERY_LOCATION_STORAGE_KEY, JSON.stringify(normalized));
    else localStorage.removeItem(DELIVERY_LOCATION_STORAGE_KEY);
  }
  return normalized;
}
