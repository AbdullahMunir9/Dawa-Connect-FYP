const allowedPath = /^v1\/(styles|tilejson|tile|font|fonts)\/[a-zA-Z0-9_.,+%{}@ /-]+$/;

export function validMapResource(path) {
  if (typeof path !== 'string' || path.length >= 700) return false;
  try {
    let decoded = path;
    for (let i = 0; i < 4 && decoded.includes('%'); i++) decoded = decodeURIComponent(decoded);
    return !decoded.includes('%') && allowedPath.test(decoded) && !decoded.includes('..') && !decoded.includes('\\');
  } catch { return false; }
}

export function rewriteMapResources(value) {
  if (Array.isArray(value)) return value.map(rewriteMapResources);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteMapResources(child)]));
  if (typeof value !== 'string' || !value.startsWith('https://maps.geoapify.com/')) return value;
  const url = new URL(value);
  // Replace only provider asset URLs; never expose the server credential.
  const resource = decodeURI(url.pathname).replace(/^\//, '');
  if (!validMapResource(resource)) throw new Error('Unsupported basemap resource.');
  url.searchParams.delete('apiKey');
  url.searchParams.delete('api_key');
  return `/api/healthcare/map/${resource}${url.search}`;
}

export function healthcareOnlyStyle(style) {
  const safe = rewriteMapResources(style);
  // Keep streets, water and area labels; remove built-in business/transit POIs.
  // All facility pins come exclusively from our healthcare discovery endpoint.
  return { ...safe, layers: (safe.layers || []).filter((layer) => {
    const source = layer['source-layer'] || '';
    return !/(^poi$|aerodrome_label|mountain_peak)/i.test(source) && !/(poi|poi_label|airport_label|railway_station)/i.test(layer.id);
  }) };
}
