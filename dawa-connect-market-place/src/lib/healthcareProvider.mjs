import { distanceKm, validateCoordinates } from './healthcareGeo.mjs';

const API_ORIGIN = 'https://api.geoapify.com';
const CATEGORIES = ['healthcare.pharmacy', 'healthcare.hospital', 'healthcare.clinic_or_praxis'];
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const AREA_TYPES = new Set(['locality', 'suburb', 'district', 'postcode', 'city', 'county', 'state', 'country']);

export class HealthcareProviderError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = 'HealthcareProviderError';
    this.code = code;
    this.status = status;
  }
}

function text(value, limit = 300) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function point(latitude, longitude) {
  // Do not turn absent coordinates, booleans, or empty strings into zero.
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return validateCoordinates(latitude, longitude);
}

function featurePoint(feature) {
  const properties = feature?.properties;
  if (properties?.lat != null || properties?.lon != null) return point(properties.lat, properties.lon);
  if (feature?.geometry?.type !== 'Point') return null;
  const coordinates = feature.geometry.coordinates;
  return Array.isArray(coordinates) ? point(coordinates[1], coordinates[0]) : null;
}

function facilityType(categories) {
  if (!Array.isArray(categories)) return null;
  if (categories.includes('healthcare.pharmacy')) return 'pharmacy';
  if (categories.includes('healthcare.hospital')) return 'hospital';
  if (categories.some((category) => typeof category === 'string' &&
    (category === 'healthcare.clinic_or_praxis' || category.startsWith('healthcare.clinic_or_praxis.')))) return 'clinic';
  return null;
}

function normalizeFacility(feature, center, radiusKm) {
  const properties = feature?.properties;
  const coordinates = featurePoint(feature);
  const type = facilityType(properties?.categories);
  const placeId = text(properties?.place_id, 1000);
  const country = text(properties?.country_code).toLowerCase();
  if (!coordinates || !type || !placeId || (country && country !== 'pk')) return null;
  if (distanceKm(center, coordinates) > radiusKm) return null;
  const raw = properties?.datasource?.raw;
  return {
    id: `geoapify:${placeId}`,
    name: text(properties.name) || text(raw?.name) || `Unnamed ${type}`,
    type,
    registered: false,
    ...coordinates,
    address: text(properties.formatted, 600) ||
      [text(properties.address_line1), text(properties.address_line2)].filter(Boolean).join(', '),
    phone: text(properties.contact?.phone, 80) || text(raw?.['contact:phone'], 80) || text(raw?.phone, 80),
    city: text(properties.city),
    // Opening hours strings cannot safely be interpreted as a live open status.
    isOpen: null,
    source: 'Geoapify / OpenStreetMap',
  };
}

function invalidInput(message) {
  return new HealthcareProviderError('invalid_request', message, 400);
}

function noRoute() {
  return new HealthcareProviderError('no_route', 'No route was found between these locations. Try another travel mode or starting point.', 404);
}

/** Server-only adapter. Return only allowlisted data, never upstream URLs or API keys. */
export function createHealthcareProvider({ apiKey = () => process.env.GEOAPIFY_API_KEY, fetcher = fetch } = {}) {
  async function requestOnce(path, parameters, { routing = false } = {}) {
    const key = text(typeof apiKey === 'function' ? apiKey() : apiKey, 512);
    if (!key) {
      throw new HealthcareProviderError('not_configured', 'External map services are not configured yet. Registered DAWA Connect pharmacies can still be shown.');
    }
    const url = new URL(path, API_ORIGIN);
    url.search = new URLSearchParams({ ...parameters, apiKey: key }).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetcher(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'error',
      });
      if (response.status === 429) {
        throw new HealthcareProviderError('quota_exceeded', 'The map service has reached its request limit. Please try again later.', 429);
      }
      if (response.status === 401 || response.status === 403) {
        throw new HealthcareProviderError('key_rejected', 'The map service configuration needs attention. Please try again later.');
      }
      if (routing && [400, 404].includes(response.status)) throw noRoute();
      if (!response.ok) throw new HealthcareProviderError('unavailable', 'The map service is temporarily unavailable. Please try again.');
      const data = await response.json();
      if (!data || !Array.isArray(data.features)) {
        throw new HealthcareProviderError('invalid_response', 'The map service returned an unexpected response. Please try again.');
      }
      return data.features;
    } catch (error) {
      if (error instanceof HealthcareProviderError) throw error;
      // Network errors can contain the request URL, including its secret key.
      throw new HealthcareProviderError('unavailable', controller.signal.aborted
        ? 'The map service took too long to respond. Please try again.'
        : 'The map service could not be reached. Please try again.');
    } finally {
      clearTimeout(timeout);
    }
  }

  async function request(path, parameters, options) {
    try { return await requestOnce(path, parameters, options); }
    catch (error) {
      // Retry an idempotent GET once for transient connection/provider failures.
      // Never retry rejected credentials, invalid requests or quota responses.
      if (error.code !== 'unavailable') throw error;
      return requestOnce(path, parameters, options);
    }
  }

  return {
    async nearby({ latitude, longitude, radiusKm, offset = 0, pages = MAX_PAGES }) {
      const center = point(latitude, longitude);
      if (!center || !Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 50 ||
        !Number.isInteger(offset) || offset < 0 || offset > 9900 || !Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES) {
        throw invalidInput('Choose valid coordinates and a search radius from 1 to 50 km.');
      }
      const facilities = new Map();
      let truncated = false;
      for (let page = 0; page < pages; page += 1) {
        const features = await request('/v2/places', {
          categories: CATEGORIES.join(','),
          filter: `circle:${longitude},${latitude},${Math.round(radiusKm * 1000)}`,
          bias: `proximity:${longitude},${latitude}`,
          lang: 'en',
          limit: String(PAGE_SIZE),
          offset: String(offset + page * PAGE_SIZE),
        });
        for (const feature of features.slice(0, PAGE_SIZE)) {
          const facility = normalizeFacility(feature, center, radiusKm);
          if (facility) facilities.set(facility.id, facility);
        }
        if (features.length < PAGE_SIZE) break;
        // A full final page means more may exist; do not claim exhaustive coverage.
        truncated = page === pages - 1;
      }
      return {
        facilities: [...facilities.values()].sort((left, right) =>
          distanceKm(center, left) - distanceKm(center, right) || left.id.localeCompare(right.id)),
        truncated,
      };
    },

    async areas(query) {
      if (typeof query !== 'string' || query.trim().length < 2 || query.trim().length > 120) {
        throw invalidInput('Enter an area or city name between 2 and 120 characters.');
      }
      const features = await request('/v1/geocode/search', {
        text: query.trim(),
        type: 'locality',
        filter: 'countrycode:pk',
        lang: 'en',
        limit: '5',
        format: 'geojson',
      });
      const results = new Map();
      for (const feature of features) {
        const properties = feature?.properties;
        const coordinates = featurePoint(feature);
        const label = text(properties?.formatted, 600);
        const id = text(properties?.place_id, 1000);
        if (!coordinates || !id || !label || text(properties?.country_code).toLowerCase() !== 'pk' ||
          !AREA_TYPES.has(properties?.result_type)) continue;
        results.set(id, { id: `geoapify:${id}`, label, ...coordinates });
        if (results.size === 5) break;
      }
      return [...results.values()];
    },

    async directions({ from, to, mode = 'drive' }) {
      const origin = point(from?.latitude, from?.longitude);
      const destination = point(to?.latitude, to?.longitude);
      if (!origin || !destination || !['drive', 'walk'].includes(mode)) {
        throw invalidInput('Choose valid start and destination points and driving or walking directions.');
      }
      const features = await request('/v1/routing', {
        waypoints: `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`,
        mode,
        units: 'metric',
        lang: 'en',
        details: 'instruction_details',
        format: 'geojson',
      }, { routing: true });
      const route = features[0];
      if (!route) throw noRoute();
      const properties = route.properties;
      const geometry = route.geometry;
      const segments = geometry?.type === 'MultiLineString' ? geometry.coordinates :
        geometry?.type === 'LineString' ? [geometry.coordinates] : null;
      if (!Array.isArray(segments) || !segments.length ||
        !Number.isFinite(properties?.distance) || properties.distance < 0 ||
        !Number.isFinite(properties?.time) || properties.time < 0) throw noRoute();
      const coordinates = [];
      for (const segment of segments) {
        if (!Array.isArray(segment) || segment.length < 2) throw noRoute();
        for (const coordinate of segment) {
          const location = Array.isArray(coordinate) ? point(coordinate[1], coordinate[0]) : null;
          // Never connect across a corrupt coordinate by silently filtering it out.
          if (!location) throw noRoute();
          const previous = coordinates.at(-1);
          if (!previous || previous[0] !== location.latitude || previous[1] !== location.longitude) {
            coordinates.push([location.latitude, location.longitude]);
          }
        }
      }
      if (coordinates.length < 2) throw noRoute();
      const legs = Array.isArray(properties.legs) ? properties.legs : [];
      const steps = legs.flatMap((leg) => Array.isArray(leg?.steps) ? leg.steps : [])
        .map((step) => ({
          instruction: text(step?.instruction?.text, 1000),
          distanceMeters: Number.isFinite(step?.distance) && step.distance >= 0 ? step.distance : null,
        }))
        .filter((step) => step.instruction);
      return {
        coordinates,
        distanceKm: properties.distance / 1000,
        durationMinutes: properties.time / 60,
        steps,
        mode,
      };
    },
  };
}
