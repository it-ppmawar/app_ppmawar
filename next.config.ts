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
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Alias @vladmandic/face-api to false on server build
      // Prevents missing canvas / tfjs-node errors on Linux CI runners
      config.resolve.alias = {
        ...config.resolve.alias,
        '@vladmandic/face-api': false,
      };
    }
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
