import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { MIME_BY_EXT, resolveUploadPath } from "@/lib/uploads";

export const runtime = "nodejs";

// Serves files from UPLOAD_DIR (Next only serves public/ files that existed at
// startup, so runtime uploads need their own route). Supports Range requests
// so videos can seek/stream.
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const filePath = resolveUploadPath(segments);
  if (!filePath) return new Response("Not found", { status: 404 });

  const info = await stat(filePath).catch(() => null);
  if (!info || !info.isFile()) return new Response("Not found", { status: 404 });

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const headers: Record<string, string> = {
    "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    // File names are random UUIDs and never overwritten, so they can cache forever.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : info.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : info.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, info.size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    return new Response(Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
    headers: { ...headers, "Content-Length": String(info.size) },
  });
}
