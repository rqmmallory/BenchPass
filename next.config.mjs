/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required on Next 14 for instrumentation.ts (Sentry init).
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      // Instrument photos and shop logos are served from Supabase Storage.
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
