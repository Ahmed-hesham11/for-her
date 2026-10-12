import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MIME_BY_EXT, UPLOAD_DIR, UPLOAD_FOLDERS } from "@/lib/uploads";

export const runtime = "nodejs";

// Raw-body upload: the browser POSTs the file bytes as the request body
// (not multipart) so a large video is streamed to disk instead of buffered.
// ?folder=products|categories|orders&name=<original file name>
export async function POST(request: NextRequest) {
  const { profile } = await requireAdmin();

  const folder = request.nextUrl.searchParams.get("folder") ?? "";
  const originalName = request.nextUrl.searchParams.get("name") ?? "file";
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  const isVideo = contentType.startsWith("video/");
  const isImage = contentType.startsWith("image/");

  if (!UPLOAD_FOLDERS.has(folder)) return NextResponse.json({ error: "Invalid folder." }, { status: 400 });
  if (!isVideo && !isImage) return NextResponse.json({ error: "يرجى اختيار صورة أو فيديو." }, { status: 400 });
  if (!request.body) return NextResponse.json({ error: "Empty upload." }, { status: 400 });

  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > limit) {
    return NextResponse.json({ error: isVideo ? "يجب ألا يتجاوز حجم الفيديو 200 ميجابايت." : "يجب ألا يتجاوز حجم الصورة 5 ميجابايت." }, { status: 413 });
  }

  const ext = (originalName.split(".").pop() ?? "").toLowerCase();
  const safeExt = MIME_BY_EXT[ext] && MIME_BY_EXT[ext].startsWith(isVideo ? "video/" : "image/") ? ext : isVideo ? "mp4" : "jpg";
  const fileName = `${randomUUID()}.${safeExt}`;
  const dir = path.join(UPLOAD_DIR, folder);
  const target = path.join(dir, fileName);

  await mkdir(dir, { recursive: true });

  // Enforce the cap on bytes actually received, not just the declared length.
  let received = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > limit) callback(new Error("TOO_LARGE"));
      else callback(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(request.body as never), limiter, createWriteStream(target));
  } catch (error) {
    await unlink(target).catch(() => {});
    if (error instanceof Error && error.message === "TOO_LARGE") {
      return NextResponse.json({ error: "الملف أكبر من الحد المسموح." }, { status: 413 });
    }
    return NextResponse.json({ error: "تعذّر رفع الملف الآن." }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  const url = `${origin}/uploads/${folder}/${fileName}`;

  if (supabaseAdmin) {
    await logAdminAction(supabaseAdmin, profile, {
      action: "upload",
      entity_type: isVideo ? "video" : "image",
      entity_id: null,
      summary: `رفع ${isVideo ? "فيديو" : "صورة"} "${originalName}" إلى "${folder}"`,
    });
  }

  return NextResponse.json({ url });
}
