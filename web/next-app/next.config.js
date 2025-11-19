/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // Disable image optimization to avoid build issues
    domains: ['lenquant.com', 'localhost'],
  },
};

module.exports = nextConfig;

