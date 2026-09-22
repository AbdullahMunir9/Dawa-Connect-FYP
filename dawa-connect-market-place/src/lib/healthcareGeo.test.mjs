import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCoordinates,
  distanceKm,
  normalizeRegisteredPharmacy,
  filterNearbyFacilities,
  mergeHealthcareFacilities,
} from "./healthcareGeo.mjs";

const origin = { latitude: 31.5204, longitude: 74.3587 };
const pharmacy = (overrides = {}) => ({
  id: "registered-1", name: "Care Plus Pharmacy", type: "pharmacy", registered: true,
  source: "DawaConnect", phone: "+92 (42) 1234-5678", ...origin, ...overrides,
});
const external = (overrides = {}) => pharmacy({ id: "external-1", registered: false, source: "OpenStreetMap", ...overrides });

test("coordinates accept real zero, decimal strings, and inclusive geographic bounds", () => {
  assert.deepEqual(validateCoordinates(0, 0), { latitude: 0, longitude: 0 });
  assert.deepEqual(validateCoordinates(" 31.5204 ", "74.3587"), origin);
  assert.deepEqual(validateCoordinates(-90, 180), { latitude: -90, longitude: 180 });
});

test("coordinates reject missing, empty, coerced and out-of-range values", () => {
  for (const invalid of [null, undefined, "", " ", false, true, [], {}, NaN, Infinity, "Infinity", "0x10", "31.2x"]) {
    assert.equal(validateCoordinates(invalid, 0), null);
    assert.equal(validateCoordinates(0, invalid), null);
  }
  assert.equal(validateCoordinates(90.01, 0), null);
  assert.equal(validateCoordinates(0, -180.01), null);
});

test("distance handles same point, one degree, date line and missing coordinates", () => {
  assert.equal(distanceKm(origin, origin), 0);
  const distance = distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
  assert.ok(Math.abs(distance - 111.195) < 0.001);
  const crossing = distanceKm({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 });
  assert.ok(crossing > 22 && crossing < 23);
  assert.equal(distanceKm(origin, { latitude: null, longitude: 0 }), Infinity);
  assert.ok(Number.isFinite(distanceKm({ latitude: -90, longitude: 0 }, { latitude: 90, longitude: 180 })));
});

test("registered catalog view maps to a public facility without private owner fields", () => {
  const normalized = normalizeRegisteredPharmacy(pharmacy({ address: "12 Main Road", area: "Gulberg", city: "Lahore", province: "Punjab", rating: "4.2", reviewCount: "3", isOpen: false, email: "private@example.test" }));
  assert.equal(normalized.href, "/pharmacies/registered-1");
  assert.equal(normalized.address, "12 Main Road, Gulberg, Lahore, Punjab");
  assert.equal(normalized.rating, 4.2);
  assert.equal(normalized.reviewCount, 3);
  assert.equal(normalized.isOpen, false);
  assert.equal(normalized.registered, true);
  assert.equal(normalized.email, undefined);
});

test("normalization skips missing map positions and preserves GeoJSON coordinate ordering", () => {
  assert.equal(normalizeRegisteredPharmacy({ id: "one", latitude: null, longitude: "" }), null);
  assert.equal(normalizeRegisteredPharmacy({ ...origin }), null);
  const result = normalizeRegisteredPharmacy({ id: "one", location: { type: "Point", coordinates: [74.3587, 31.5204] } });
  assert.equal(result.latitude, origin.latitude);
  assert.equal(result.longitude, origin.longitude);
  assert.equal(result.rating, null);
  assert.equal(result.reviewCount, 0);
  assert.equal(result.isOpen, null);
  assert.equal(normalizeRegisteredPharmacy({ id: "one", location: { type: "Point", coordinates: [181, 92] } }), null);
});

test("nearby filtering enforces healthcare-only allowlist, radius and nearest order without mutation", () => {
  const near = external({ id: "near", longitude: origin.longitude + 0.001 });
  const far = external({ id: "far", latitude: origin.latitude + 0.2 });
  const clinic = external({ id: "clinic", type: "clinic" });
  const invalid = external({ id: "invalid", latitude: "" });
  const restaurant = external({ id: "restaurant", type: "restaurant" });
  const items = [near, far, clinic, invalid, restaurant];
  const result = filterNearbyFacilities(items, origin);
  assert.deepEqual(result.map((item) => item.id), ["clinic", "near"]);
  assert.ok(result[1].distanceKm > 0);
  assert.equal(near.distanceKm, undefined);
  assert.deepEqual(filterNearbyFacilities(items, { ...origin, types: ["pharmacy", "restaurant"] }).map((item) => item.id), ["near"]);
  assert.deepEqual(filterNearbyFacilities(items, { ...origin, types: [] }), []);
  assert.deepEqual(filterNearbyFacilities(items, { ...origin, radiusKm: -1 }), []);
  assert.deepEqual(filterNearbyFacilities(items, { ...origin, radiusKm: "" }), []);
  assert.deepEqual(filterNearbyFacilities(items, { latitude: null, longitude: 0 }), []);
});

test("external pharmacy duplicates prefer registered record by exact normalized name within 100m", () => {
  const registered = pharmacy({ phone: "" });
  const close = external({ name: "CARE-plus PHARMACY", phone: "", latitude: origin.latitude + 0.0005 });
  assert.deepEqual(mergeHealthcareFacilities([registered], [close]), [registered]);
  const branch = { ...close, id: "another-branch", latitude: origin.latitude + 0.002 };
  assert.deepEqual(mergeHealthcareFacilities([registered], [branch]), [registered, branch]);
});

test("matching international phone numbers can identify nearby renamed pharmacies", () => {
  const registered = pharmacy();
  const renamed = external({ name: "Care Plus Medical Store", phone: "0092 42 12345678" });
  assert.equal(mergeHealthcareFacilities([registered], [renamed]).length, 1);
  const farBranch = { ...renamed, latitude: origin.latitude + 0.003 };
  assert.equal(mergeHealthcareFacilities([registered], [farBranch]).length, 2);
});

test("deduplication preserves colocated clinics, distinct businesses, and generic pharmacy names", () => {
  const registered = pharmacy();
  const clinic = external({ type: "clinic" });
  const hospital = external({ id: "hospital", type: "hospital" });
  const other = external({ id: "other", name: "Care Medical", phone: "" });
  assert.equal(mergeHealthcareFacilities([registered], [clinic, hospital, other]).length, 4);
  assert.equal(mergeHealthcareFacilities([pharmacy({ name: "Pharmacy", phone: "" })], [external({ name: "Pharmacy", phone: "" })]).length, 2);
});

test("repeated external provider IDs are collapsed while different provider IDs remain", () => {
  const item = external({ name: "Other Pharmacy", phone: "" });
  assert.equal(mergeHealthcareFacilities([], [item, { ...item }]).length, 1);
  assert.equal(mergeHealthcareFacilities([], [item, { ...item, source: "Another provider" }]).length, 2);
});
