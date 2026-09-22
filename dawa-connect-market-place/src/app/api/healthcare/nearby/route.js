import { NextResponse } from 'next/server';
import { createHealthcareProvider } from '@/lib/healthcareProvider.mjs';
import { validateCoordinates, normalizeRegisteredPharmacy, filterNearbyFacilities, mergeHealthcareFacilities } from '@/lib/healthcareGeo.mjs';
import { allowMapRequest, apiError, cachedMapRequest, withMapDeadline } from '@/lib/healthcareApi';

export async function GET(request) {
  if (!allowMapRequest(request)) return apiError('Too many map searches. Please wait a minute.', 429);
  const params = new URL(request.url).searchParams;
  const point = validateCoordinates(params.get('lat'), params.get('lng'));
  const radiusKm = Number(params.get('radius') || 10);
  const offset = Number(params.get('offset') || 0);
  if (!point || ![2, 5, 10, 20, 50].includes(radiusKm) || !Number.isInteger(offset) || offset < 0 || offset > 9900 || offset % 100 !== 0) return apiError('Choose valid coordinates, a supported search radius and a valid page.');
  const filter = { ...point, radiusKm };
  const [registeredResult, externalResult] = await Promise.allSettled([
    withMapDeadline(cachedMapRequest('registered-map-pharmacies', 30000, async () => {
      const { listMapPharmacies } = await import('@/lib/pharmacyCatalog');
      return (await listMapPharmacies()).map(normalizeRegisteredPharmacy).filter(Boolean);
    })),
    cachedMapRequest(`places-page:${point.latitude},${point.longitude}:${radiusKm}:${offset}`, 180000,
      () => createHealthcareProvider().nearby({ ...point, radiusKm, offset, pages: 1 }))
  ]);
  const warnings = [];
  if (registeredResult.status === 'rejected') warnings.push('DAWA Connect pharmacies could not be loaded. External results do not confirm membership. Please retry.');
  if (externalResult.status === 'rejected') warnings.push(externalResult.reason?.code ? externalResult.reason.message : 'External healthcare listings are temporarily unavailable.');
  const registered = filterNearbyFacilities(registeredResult.status === 'fulfilled' ? registeredResult.value : [], filter);
  const external = filterNearbyFacilities(externalResult.status === 'fulfilled' ? externalResult.value.facilities : [], filter);
  const combined = mergeHealthcareFacilities(registered, external);
  return NextResponse.json({
    registered: combined.filter((place) => place.registered), external: combined.filter((place) => !place.registered),
    warnings, truncated: externalResult.status === 'fulfilled' && externalResult.value.truncated,
    nextOffset: externalResult.status === 'fulfilled' && externalResult.value.truncated && offset < 9900 ? offset + 100 : null,
    sources: { registered: registeredResult.status === 'fulfilled', external: externalResult.status === 'fulfilled' }
  }, { headers: { 'Cache-Control': 'no-store' } });
}
