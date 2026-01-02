/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.blotato.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
    ],
  },
};

module.exports = nextConfig;
