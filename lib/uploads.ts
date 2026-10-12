import path from "node:path";

// Where uploaded product/category/order media lives on the server's disk.
// Must be a persistent folder on the VPS (outside the build/deploy directory,
// or it'll be wiped on redeploy). Served back through /uploads/[...path].
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export const UPLOAD_FOLDERS = new Set(["products", "categories", "orders"]);

export const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
};

// Resolves a request path under UPLOAD_DIR, or null if it would escape it.
export function resolveUploadPath(segments: string[]): string | null {
  const resolved = path.resolve(UPLOAD_DIR, ...segments);
  return resolved.startsWith(UPLOAD_DIR + path.sep) ? resolved : null;
}
