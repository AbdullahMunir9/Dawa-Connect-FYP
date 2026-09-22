import { apiError, allowMapRequest, cachedMapRequest } from '@/lib/healthcareApi';
import { validMapResource, healthcareOnlyStyle, rewriteMapResources } from '@/lib/healthcareMapStyle.mjs';

export async function GET(request, context) {
  if (!allowMapRequest(request, 'tiles', 600)) return apiError('The map is receiving too many requests. Please retry shortly.', 429);
  const { resource } = await context.params;
  const path = resource?.join('/');
  if (!validMapResource(path)) return apiError('Invalid map resource.', 400);
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) return apiError('Map tiles are not configured. Set GEOAPIFY_API_KEY in the Marketplace .env.local and restart.', 503);
  try {
    const result = await cachedMapRequest(`tile:${path}`, 3600000, async () => {
      const url = new URL(`https://maps.geoapify.com/${path}`);
      url.searchParams.set('apiKey', key);
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
      if (!response.ok) throw new Error('Map provider unavailable.');
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      if (contentType.includes('json')) {
        const json = await response.json();
        const data = Array.isArray(json.layers) ? healthcareOnlyStyle(json) : rewriteMapResources(json);
        return { contentType: 'application/json', body: JSON.stringify(data) };
      }
      return { contentType, body: await response.arrayBuffer() };
    });
    return new Response(result.body, { headers: { 'Content-Type': result.contentType, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return apiError('The basemap could not be loaded. The healthcare list is still available. Retry shortly.', 503); }
}
