const DELIVERED_STATUS = 'delivered';
const EARTH_RADIUS_KM = 6371;

const number = (value) => {
  if (value === null || value === undefined || typeof value === 'boolean' ||
    (typeof value === 'string' && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const positiveInteger = (value) => {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const radians = (value) => value * (Math.PI / 180);

export function geographicDistanceKm(origin, destination) {
  const firstLat = number(origin?.latitude);
  const firstLng = number(origin?.longitude);
  const secondLat = number(destination?.latitude);
  const secondLng = number(destination?.longitude);
  if ([firstLat, firstLng, secondLat, secondLng].some((value) => value === null) ||
    Math.abs(firstLat) > 90 || Math.abs(secondLat) > 90 || Math.abs(firstLng) > 180 || Math.abs(secondLng) > 180) return null;
  const latitudeDifference = radians(secondLat - firstLat);
  const longitudeDifference = radians(secondLng - firstLng);
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(firstLat)) * Math.cos(radians(secondLat))
    * Math.sin(longitudeDifference / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function bearingDirection(origin, destination) {
  const latitude1 = radians(origin.latitude);
  const latitude2 = radians(destination.latitude);
  const longitudeDifference = radians(destination.longitude - origin.longitude);
  const y = Math.sin(longitudeDifference) * Math.cos(latitude2);
  const x = Math.cos(latitude1) * Math.sin(latitude2)
    - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDifference);
  const bearing = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
  const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return directions[Math.round(bearing / 45) % 8];
}

function normalizedArea(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text || text.length > 100) return '';
  // Do not permit house/street-like free text to become an aggregate area label.
  if (/\d{2,}/.test(text)) return '';
  return text;
}

function gridCell(point, gridKm, referenceLatitude) {
  const latitudeStep = gridKm / 111.32;
  const longitudeScale = Math.max(0.2, Math.cos(radians(referenceLatitude)));
  const longitudeStep = gridKm / (111.32 * longitudeScale);
  const latitudeIndex = Math.floor(point.latitude / latitudeStep);
  const longitudeIndex = Math.floor(point.longitude / longitudeStep);
  return {
    key: `${latitudeIndex}:${longitudeIndex}`,
    center: {
      latitude: (latitudeIndex + 0.5) * latitudeStep,
      longitude: (longitudeIndex + 0.5) * longitudeStep,
    },
  };
}

function confidenceFor(orders, zones) {
  if (orders >= 30 && zones >= 4) return 'high';
  if (orders >= 15 && zones >= 2) return 'medium';
  return 'low';
}

function recommendationText(status, radius, selectedScenario) {
  if (status === 'missing_location') return 'Confirm the pharmacy city and map coordinates before evaluating delivery-radius opportunities.';
  if (status === 'insufficient_data') return 'There is not enough privacy-safe city demand data yet to recommend a radius change.';
  if (status === 'keep_current_radius') return `Keep the current ${radius} km radius for now; no candidate range has enough privacy-safe demand evidence.`;
  return `Consider testing a ${selectedScenario.radiusKm} km radius. It reaches ${selectedScenario.opportunityZones} additional privacy-safe zone${selectedScenario.opportunityZones === 1 ? '' : 's'} containing ${selectedScenario.opportunityOrders} observed delivered city order${selectedScenario.opportunityOrders === 1 ? '' : 's'} in the analysis window.`;
}

export function buildCityOpportunity({
  pharmacy,
  orders = [],
  gridKm = 2,
  minimumOrdersPerZone = 5,
  minimumPharmaciesPerZone = 2,
  analysisDays = 90,
  periodStart,
  periodEnd,
} = {}) {
  const origin = {
    latitude: number(pharmacy?.latitude),
    longitude: number(pharmacy?.longitude),
  };
  const city = String(pharmacy?.city || '').trim();
  const currentRadiusKm = Math.min(50, Math.max(1, number(pharmacy?.deliveryRadius) || 10));
  if (!city || geographicDistanceKm(origin, origin) === null) {
    return {
      status: 'missing_location', city, currentRadiusKm, analysisDays,
      zones: [], scenarios: [], selectedScenario: null,
      summary: { publishedZones: 0, hiddenZones: 0, insideRadiusOrders: 0, outsideRadiusOrders: 0 },
      recommendation: recommendationText('missing_location', currentRadiusKm),
      privacy: { gridKm, minimumOrdersPerZone, minimumPharmaciesPerZone },
      limitations: ['Exact customer coordinates and individual pharmacy performance are never returned.'],
    };
  }

  const cells = new Map();
  for (const order of orders) {
    if (String(order?.status || '').toLowerCase() !== DELIVERED_STATUS) continue;
    if (String(order?.deliveryAddress?.city || '').trim().toLowerCase() !== city.toLowerCase()) continue;
    const point = {
      latitude: number(order?.deliveryAddress?.latitude),
      longitude: number(order?.deliveryAddress?.longitude),
    };
    if (geographicDistanceKm(point, point) === null) continue;
    const cell = gridCell(point, gridKm, origin.latitude);
    const existing = cells.get(cell.key) || {
      center: cell.center,
      orders: 0,
      units: 0,
      pharmacies: new Set(),
      areas: new Map(),
    };
    existing.orders += 1;
    existing.units += (order.items || []).reduce((sum, item) => sum + positiveInteger(item?.quantity ?? item?.qty), 0);
    const contributingPharmacy = String(order.ownerId || '').trim();
    if (contributingPharmacy) existing.pharmacies.add(contributingPharmacy);
    const area = normalizedArea(order?.deliveryAddress?.area);
    if (area) existing.areas.set(area, (existing.areas.get(area) || 0) + 1);
    cells.set(cell.key, existing);
  }

  let hiddenZones = 0;
  const zones = [];
  for (const cell of cells.values()) {
    if (cell.orders < minimumOrdersPerZone || cell.pharmacies.size < minimumPharmaciesPerZone) {
      hiddenZones += 1;
      continue;
    }
    const distanceKm = geographicDistanceKm(origin, cell.center);
    const [popularArea = '', popularAreaOrders = 0] = [...cell.areas.entries()]
      .sort((left, right) => right[1] - left[1])[0] || [];
    const safeAreaLabel = popularAreaOrders >= Math.min(3, minimumOrdersPerZone) ? popularArea : '';
    zones.push({
      label: safeAreaLabel || `${bearingDirection(origin, cell.center)} city zone`,
      distanceKm: Math.round(distanceKm * 10) / 10,
      orders: cell.orders,
      units: cell.units,
      insideCurrentRadius: distanceKm <= currentRadiusKm,
    });
  }
  zones.sort((left, right) => right.orders - left.orders || left.distanceKm - right.distanceKm);

  const candidateRadii = [...new Set([currentRadiusKm + 2, currentRadiusKm + 5, currentRadiusKm + 10]
    .map((radius) => Math.min(50, Math.round(radius * 10) / 10)))]
    .filter((radius) => radius > currentRadiusKm);
  const scenarios = candidateRadii.map((radiusKm) => {
    const opportunity = zones.filter((zone) => !zone.insideCurrentRadius && zone.distanceKm <= radiusKm);
    const opportunityOrders = opportunity.reduce((sum, zone) => sum + zone.orders, 0);
    return {
      radiusKm,
      additionalReachKm: Math.round((radiusKm - currentRadiusKm) * 10) / 10,
      opportunityZones: opportunity.length,
      opportunityOrders,
      opportunityUnits: opportunity.reduce((sum, zone) => sum + zone.units, 0),
      confidence: confidenceFor(opportunityOrders, opportunity.length),
    };
  });
  const selectedScenario = scenarios.find((scenario) => scenario.opportunityOrders >= 10 && scenario.opportunityZones >= 2) || null;
  const status = zones.length === 0 ? 'insufficient_data'
    : selectedScenario ? 'consider_expansion' : 'keep_current_radius';

  return {
    status,
    city,
    currentRadiusKm,
    analysisDays,
    periodStart,
    periodEnd,
    zones,
    scenarios,
    selectedScenario,
    summary: {
      publishedZones: zones.length,
      hiddenZones,
      insideRadiusOrders: zones.filter((zone) => zone.insideCurrentRadius).reduce((sum, zone) => sum + zone.orders, 0),
      outsideRadiusOrders: zones.filter((zone) => !zone.insideCurrentRadius).reduce((sum, zone) => sum + zone.orders, 0),
    },
    recommendation: recommendationText(status, currentRadiusKm, selectedScenario),
    privacy: { gridKm, minimumOrdersPerZone, minimumPharmaciesPerZone },
    limitations: [
      'Zones contain aggregated delivered orders only; exact customer coordinates and competitor identities are never returned.',
      'Observed city demand is an opportunity signal, not a guarantee that the pharmacy will receive those orders.',
      'Failed searches and out-of-radius checkout attempts are not recorded yet, so unmet demand is not included.',
      'A radius change is never applied automatically and must be reviewed by the pharmacy owner.',
    ],
  };
}
