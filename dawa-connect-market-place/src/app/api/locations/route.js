import { NextResponse } from 'next/server';
import { createHealthcareProvider } from '@/lib/healthcareProvider.mjs';
import { allowMapRequest, apiError, cachedMapRequest, safeMapFailure } from '@/lib/healthcareApi';

export async function GET(request) {
  if (!allowMapRequest(request, 'delivery-location', 30)) {
    return apiError('Too many location searches. Please wait a minute.', 429);
  }

  const parameters = new URL(request.url).searchParams;
  const query = parameters.get('q')?.trim();
  const latitude = Number(parameters.get('latitude'));
  const longitude = Number(parameters.get('longitude'));
  const provider = createHealthcareProvider();

  try {
    if (query) {
      if (query.length < 3 || query.length > 160) return apiError('Enter an address, area or city (3–160 characters).');
      const locations = await cachedMapRequest(
        `delivery-location:${query.toLowerCase()}`,
        300000,
        () => provider.locations(query),
      );
      return NextResponse.json({ locations });
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return apiError('Provide an address search or valid coordinates.');
    }
    const cacheKey = `delivery-reverse:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
    const location = await cachedMapRequest(cacheKey, 300000, () => provider.reverseLocation({ latitude, longitude }));
    return NextResponse.json({ location });
  } catch (error) {
    return safeMapFailure(error);
  }
}
