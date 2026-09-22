import { NextResponse } from 'next/server';
import { createHealthcareProvider } from '@/lib/healthcareProvider.mjs';
import { validateCoordinates, distanceKm } from '@/lib/healthcareGeo.mjs';
import { allowMapRequest, apiError, cachedMapRequest, safeMapFailure } from '@/lib/healthcareApi';

export async function GET(request) {
  if (!allowMapRequest(request, 'directions', 20)) return apiError('Too many direction requests. Please wait a minute.', 429);
  const params = new URL(request.url).searchParams;
  const from = validateCoordinates(params.get('fromLat'), params.get('fromLng'));
  const to = validateCoordinates(params.get('toLat'), params.get('toLng'));
  const mode = params.get('mode') || 'drive';
  if (!from || !to || !['drive', 'walk'].includes(mode)) return apiError('Choose valid start and destination points and a driving or walking mode.');
  if (distanceKm(from, to) > 150) return apiError('Directions are limited to destinations within 150 km of the start point.');
  try {
    const key = `route:${from.latitude},${from.longitude}:${to.latitude},${to.longitude}:${mode}`;
    const route = await cachedMapRequest(key, 120000, () => createHealthcareProvider().directions({ from, to, mode }));
    return NextResponse.json(route);
  } catch (error) { return safeMapFailure(error); }
}
