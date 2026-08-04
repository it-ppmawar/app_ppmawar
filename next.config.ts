import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mawar.smartpesantren.id',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ['@vladmandic/face-api'],
  turbopack: {},
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
