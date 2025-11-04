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
  // Enable standalone output for Fly.io deployment (reduces Docker image size)
  output: 'standalone',
   async redirects() {
    return [
     {
       source: '/',
        destination: '/agent-ui?agentConfig=dental',
        permanent: false,
      },
     ];
   },
};

export default nextConfig;
