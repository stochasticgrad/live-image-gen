// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
        port: '',
        pathname: '/private/**',
      },
      {
        protocol: 'https',
        hostname: 'v3.fal.media',
        port: '',
        pathname: '/files/**', // Adjust if needed
      },
      {
        protocol: 'https',
        hostname: 'ucbfdndrowimghoiinsm.supabase.co',
        port: '',
        pathname: '/storage/**', // Adjust if needed
      },
    ],
  },
};

export default nextConfig;