/** Provider-independent, browser-safe helpers for the public healthcare map. */
export const HEALTHCARE_TYPES = Object.freeze(["pharmacy", "hospital", "clinic"]);

function finiteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Missing coordinates must never become the valid (0, 0) point by coercion. */
export function validateCoordinates(latitude, longitude) {
  const lat = finiteNumber(latitude);
  const lng = finiteNumber(longitude);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
}

/** Great-circle distance; this is not a driving distance or an ETA. */
export function distanceKm(origin, destination) {
  const from = validateCoordinates(origin?.latitude, origin?.longitude);
  const to = validateCoordinates(destination?.latitude, destination?.longitude);
  if (!from || !to) return Infinity;
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDifference = radians(to.latitude - from.latitude);
  const longitudeDifference = radians(to.longitude - from.longitude);
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
    * Math.sin(longitudeDifference / 2) ** 2;
  // Clamp rounding at coincident / antipodal locations before the square root.
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedName(value) {
  return cleanText(value).normalize("NFKC").toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function normalizedPhone(value) {
  const digits = cleanText(value).replace(/\D/g, "").replace(/^00/, "");
  // Avoid matching short codes, missing data or placeholder values.
  return digits.length >= 7 && digits.length <= 15 && !/^([0-9])\1+$/.test(digits) ? digits : "";
}

function fullAddress(pharmacy) {
  const seen = new Set();
  return [pharmacy.address, pharmacy.area, pharmacy.city, pharmacy.province]
    .map(cleanText)
    .filter((part) => {
      const normalized = normalizedName(part);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }).join(", ");
}

/** Accepts an approved pharmacy catalog view; approval filtering belongs to the DB query. */
export function normalizeRegisteredPharmacy(pharmacy) {
  if (!pharmacy || typeof pharmacy !== "object") return null;
  const rawId = pharmacy.id ?? pharmacy._id;
  const id = rawId == null ? "" : String(rawId).trim();
  if (!id) return null;
  let point = validateCoordinates(pharmacy.latitude, pharmacy.longitude);
  if (!point && pharmacy.location?.type === "Point" && Array.isArray(pharmacy.location.coordinates)) {
    // GeoJSON stores longitude first; map state stores latitude first.
    const [longitude, latitude] = pharmacy.location.coordinates;
    point = validateCoordinates(latitude, longitude);
  }
  if (!point) return null;
  const rating = finiteNumber(pharmacy.rating);
  const reviewCount = finiteNumber(pharmacy.reviewCount);
  return {
    id,
    name: cleanText(pharmacy.name) || "Registered pharmacy",
    type: "pharmacy",
    registered: true,
    ...point,
    address: fullAddress(pharmacy),
    phone: cleanText(pharmacy.phone),
    city: cleanText(pharmacy.city),
    isOpen: typeof pharmacy.isOpen === "boolean" ? pharmacy.isOpen : null,
    rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
    reviewCount: reviewCount !== null && reviewCount > 0 ? Math.floor(reviewCount) : 0,
    href: `/pharmacies/${encodeURIComponent(id)}`,
    source: "DawaConnect",
  };
}

/** Filter every source by the same radius / allowlist; return copies sorted nearest first. */
export function filterNearbyFacilities(facilities, {
  latitude,
  longitude,
  radiusKm = 10,
  types = HEALTHCARE_TYPES,
} = {}) {
  const origin = validateCoordinates(latitude, longitude);
  const radius = finiteNumber(radiusKm);
  if (!origin || radius === null || radius <= 0 || !Array.isArray(facilities) || !Array.isArray(types)) return [];
  const allowedTypes = new Set(types.filter((type) => HEALTHCARE_TYPES.includes(type)));
  return facilities.flatMap((facility) => {
    if (!facility || !allowedTypes.has(facility.type)) return [];
    const point = validateCoordinates(facility.latitude, facility.longitude);
    if (!point) return [];
    const distance = distanceKm(origin, point);
    return distance <= radius ? [{ ...facility, ...point, distanceKm: distance }] : [];
  }).sort((first, second) => first.distanceKm - second.distanceKm
    || cleanText(first.name).localeCompare(cleanText(second.name))
    || String(first.id ?? "").localeCompare(String(second.id ?? "")));
}

function samePharmacy(registered, external) {
  if (registered.type !== "pharmacy" || external.type !== "pharmacy") return false;
  if (distanceKm(registered, external) > 0.1) return false;
  const registeredPhone = normalizedPhone(registered.phone);
  if (registeredPhone && registeredPhone === normalizedPhone(external.phone)) return true;
  const name = normalizedName(registered.name);
  // Generic labels are not evidence that two colocated businesses are the same.
  const genericNames = new Set(["pharmacy", "registered pharmacy", "unnamed pharmacy", "medical store", "chemist", "drugstore"]);
  return name.length >= 4 && !genericNames.has(name) && name === normalizedName(external.name);
}

/**
 * Registered records win over matching external pharmacies. Never merge a hospital
 * or clinic merely because it shares a building, name or phone with a pharmacy.
 * No fuzzy name or phone-suffix matching: false merges can hide real businesses.
 */
export function mergeHealthcareFacilities(registeredFacilities = [], externalFacilities = []) {
  const registered = (Array.isArray(registeredFacilities) ? registeredFacilities : []).filter(Boolean);
  const external = (Array.isArray(externalFacilities) ? externalFacilities : []).filter(Boolean);
  const seenExternalIds = new Set();
  return [...registered, ...external.filter((facility) => {
    if (registered.some((pharmacy) => samePharmacy(pharmacy, facility))) return false;
    // Repeated IDs from the same provider are duplicates, not same-name branches.
    if (facility.id != null && String(facility.id) !== "") {
      const key = `${facility.source || ""}:${facility.type}:${facility.id}`;
      if (seenExternalIds.has(key)) return false;
      seenExternalIds.add(key);
    }
    return true;
  })];
}
