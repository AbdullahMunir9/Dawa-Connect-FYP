/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/healthcare/renderer/*': [
      './node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs',
      './node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs',
    ],
  },
}

module.exports = nextConfig
