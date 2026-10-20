const nextConfig = {
  images: {
    unoptimized: true,
  },

  outputFileTracingIncludes: {
    '/api/source-zip': [
      './{app,assets-src,components,hooks,lib,public,scripts,styles,tests,types}/**/*',
      './*.{json,mjs,js,ts,yaml,yml,md}',
      './.gitignore',
    ],
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }]
  },
}

export default nextConfig
