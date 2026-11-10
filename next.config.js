/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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
