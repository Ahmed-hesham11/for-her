export const SITE_NAME = "FOR HER";
export const SITE_TAGLINE = "More Than A Look";
export const SITE_DESCRIPTION = "Premium women's fashion, bags, jewelry, and accessories.";

// Canonical origin used for metadata, the sitemap and Open Graph URLs.
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

// Resolves a possibly-relative image path to an absolute URL for crawlers.
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${getSiteUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}
