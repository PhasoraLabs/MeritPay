import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default dev server in Next.js 16.
  // Declaring it explicitly silences the webpack-config warning.
  // Turbopack supports WASM natively — no extra config needed.
  turbopack: {},

  // webpack config is still used for `next build` (production).
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      buffer: require.resolve('buffer/'),
    };
    return config;
  },
};

export default nextConfig;
