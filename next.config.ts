import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow dev assets (/_next/*) to be requested from your external tunnel domain
  allowedDevOrigins: [
    'asandia.loca.lt',
  ],
  // Skip ESLint during production builds for now
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip TypeScript type checking during builds (temporary - for faster deployment)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Enable standalone output for Fly.io deployment (reduces Docker image size)
  output: 'standalone',
  // Exclude retell folder from Next.js compilation (it's a standalone server)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'express-ws': 'commonjs express-ws',
      });
    }
    return config;
  },
};

export default nextConfig;
