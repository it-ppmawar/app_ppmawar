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
  // Exclude browser-only libraries from server-side bundle
  serverExternalPackages: ['@vladmandic/face-api'],
};

export default nextConfig;
