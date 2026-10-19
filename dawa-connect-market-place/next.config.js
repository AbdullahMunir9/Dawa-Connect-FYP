/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
  outputFileTracingIncludes: {
    '/api/healthcare/renderer/*': [
      './node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs',
      './node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs',
    ],
  },
}

module.exports = nextConfig
