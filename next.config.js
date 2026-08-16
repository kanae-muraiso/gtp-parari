/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  allowedDevOrigins: [
    "parari.lvh.me",
    "kanae-muraiso.lvh.me",
  ],

  transpilePackages: [
    "gtp-io",
    "gtp-lint",
    "gtp-text",
    "gtp-schema",
  ],
};

module.exports = nextConfig;

