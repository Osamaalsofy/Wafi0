import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  allowedDevOrigins: process.env.NEXT_DIST_DIR ? ['127.0.0.1'] : undefined,
};

export default nextConfig;
