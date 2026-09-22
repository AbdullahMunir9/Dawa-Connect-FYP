import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';
const ASSETS = new Set(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']);

// MapLibre 6 uses separate ES module worker files. Serve its installed worker
// and shared module together so webpack cannot break their relative imports.
export async function GET(_request, context) {
  const { asset } = await context.params;
  if (!ASSETS.has(asset)) return new Response('Not found', { status: 404 });
  try {
    const source = await readFile(join(process.cwd(), 'node_modules/maplibre-gl/dist', asset));
    return new Response(source, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response('Map renderer unavailable', { status: 503 }); }
}
