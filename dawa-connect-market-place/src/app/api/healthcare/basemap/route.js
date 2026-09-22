import { NextResponse } from 'next/server';
import { apiError, allowMapRequest, cachedMapRequest } from '@/lib/healthcareApi';
import { healthcareOnlyStyle } from '@/lib/healthcareMapStyle.mjs';

// Free public basemap, separate from the metered Geoapify discovery/routing key.
// URLs are fixed by the app, not passed in by clients.
export async function GET(request) {
  if (!allowMapRequest(request, 'basemap', 60)) return apiError('Please wait a moment before reloading the map.', 429);
  try {
    const style = await cachedMapRequest('openfreemap-healthcare-style', 3600000, async () => {
      const response = await fetch('https://tiles.openfreemap.org/styles/positron', { signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok) throw new Error('Basemap unavailable.');
      const body = await response.json();
      if (!Array.isArray(body.layers) || body.version !== 8) throw new Error('Invalid basemap.');
      return healthcareOnlyStyle(body);
    });
    return NextResponse.json(style, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch { return apiError('The basemap is temporarily unavailable. You can still use the healthcare list.', 503); }
}
