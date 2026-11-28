/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@electric-sql/pglite'],
  outputFileTracingIncludes: {
    '/api/dev/class-b-lab': ['./docs/class-b-*.sql', './supabase/migrations/20261116150000_class_business_events.sql', './node_modules/@electric-sql/pglite/dist/**/*'],
  },

  async redirects() {
    return [
      { source: "/my/library-v2", destination: "/my/bookshelf", permanent: false },
      { source: "/my/library-v2/records", destination: "/my/bookshelf/records", permanent: false },
    ];
  },

  allowedDevOrigins: [
    "parari.lvh.me",
    "kanae-muraiso.lvh.me",
  ],

};

module.exports = nextConfig;
