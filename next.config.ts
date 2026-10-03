import type { NextConfig } from "next";

// Uploaded product/category images are served from this project's own
// Supabase Storage domain — derived from the existing env var rather than
// hardcoded, so this stays correct if the Supabase project ever changes.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(supabaseHostname ? [{ protocol: "https" as const, hostname: supabaseHostname }] : []),
    ],
  },
};

export default nextConfig;
