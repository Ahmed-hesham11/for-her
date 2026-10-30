import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runMetaOutbox } from "@/lib/meta-outbox-store";

export const dynamic = "force-dynamic";

// Retry worker for the Meta event outbox. Called on a schedule (hPanel cron).
// Requires `Authorization: Bearer $META_CRON_SECRET`; returns counts only.
async function handle(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.META_CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runMetaOutbox({ limit: 10 }));
  } catch (error) {
    console.error("[cron/meta-events] failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Worker failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
