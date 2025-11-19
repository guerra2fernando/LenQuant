/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: process.env.NODE_ENV === 'production',
    domains: ['lenquant.com', 'localhost'],
  },
};

module.exports = nextConfig;

