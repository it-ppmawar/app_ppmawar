import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

    // Suppress "Critical dependency: require function is used in a way in which
    // dependencies cannot be statically extracted" warning dari @vladmandic/face-api.
    // Library ini menggunakan dynamic require() secara internal (bukan dari kode kita).
    // Fungsionalitas absensi wajah tidak terpengaruh sama sekali.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/@vladmandic\/face-api/,
        message: /Critical dependency/,
      },
    ];

    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/',
        permanent: false,
      },
      {
        source: '/dashboard/tagihan',
        destination: '/dashboard/billing',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
