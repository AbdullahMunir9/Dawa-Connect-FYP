import { NextResponse } from 'next/server';
import { createHealthcareProvider } from '@/lib/healthcareProvider.mjs';
import { allowMapRequest, apiError, cachedMapRequest, safeMapFailure } from '@/lib/healthcareApi';

export async function GET(request) {
  if (!allowMapRequest(request)) return apiError('Too many searches. Please wait a minute.', 429);
  const query = new URL(request.url).searchParams.get('q')?.trim();
  if (!query || query.length < 3 || query.length > 120) return apiError('Enter a city or area name (3–120 characters).');
  try {
    const areas = await cachedMapRequest(`area:${query.toLowerCase()}`, 300000, () => createHealthcareProvider().areas(query));
    return NextResponse.json({ areas });
  } catch (error) { return safeMapFailure(error); }
}
