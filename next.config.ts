import type { NextConfig } from "next";

// Uploaded product/category images are served from this project's own
// Supabase Storage domain — derived from the existing env var rather than
// hardcoded, so this stays correct if the Supabase project ever changes.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

// Media uploaded from the admin is stored on this server and served from
// /uploads on the site's own domain — allow-list it for next/image.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined;

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(siteUrl
        ? [{ protocol: siteUrl.protocol.replace(":", "") as "http" | "https", hostname: siteUrl.hostname, ...(siteUrl.port ? { port: siteUrl.port } : {}) }]
        : []),
      ...(supabaseHostname ? [{ protocol: "https" as const, hostname: supabaseHostname }] : []),
    ],
  },
};

export default nextConfig;
