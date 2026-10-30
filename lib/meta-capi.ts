import { createHash } from "node:crypto";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

// Meta Conversions API transport. Server-only: it reads META_CAPI_ACCESS_TOKEN
// and is imported only by API routes / lib code that runs on the server.
// Events are queued in the meta_event_outbox table and delivered by
// lib/meta-outbox.ts; this file only builds user_data and talks to Meta.

// Overridable without a code change if Meta retires this version.
const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v24.0";
const REQUEST_TIMEOUT_MS = 8000;

export type MetaEvent = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url?: string;
  user_data: Record<string, unknown>;
  custom_data: Record<string, unknown>;
};

export type MetaSendResult =
  | { ok: true }
  // retryable: worth trying again later. reason is a short code safe to store/log.
  | { ok: false; retryable: boolean; reason: string };

// Request-derived matching data saved on the outbox row. Email and external id
// are stored already hashed so the table holds no extra raw PII.
export type OutboxContext = {
  em: string | null;
  external_id: string | null;
  client_ip: string | null;
  client_user_agent: string | null;
  fbp: string | null;
  fbc: string | null;
  source_url: string | null;
};

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function isMetaConfigured() {
  return Boolean(process.env.META_CAPI_ACCESS_TOKEN && META_PIXEL_ID);
}

// Egyptian numbers: 01012345678 -> 201012345678 (Meta wants country code, digits only).
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("20")) return digits;
  return `20${digits.replace(/^0+/, "")}`;
}

export function buildContext(input: {
  email: string | null;
  userId: string | null;
  clientIp: string | null;
  userAgent: string | null;
  cookieHeader: string | null;
  sourceUrl: string | null;
}): OutboxContext {
  const cookie = (name: string) => input.cookieHeader?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] ?? null;
  return {
    em: input.email?.trim() ? sha256(input.email.trim().toLowerCase()) : null,
    external_id: input.userId ? sha256(input.userId) : null,
    client_ip: input.clientIp,
    client_user_agent: input.userAgent,
    fbp: cookie("_fbp"),
    fbc: cookie("_fbc"),
    source_url: input.sourceUrl,
  };
}

export function buildUserData(
  order: { customer_name: string | null; phone_1: string | null; governorate: string | null; user_id: string | null },
  context: OutboxContext | null,
) {
  const userData: Record<string, unknown> = {};
  if (context?.em) userData.em = [context.em];
  const phone = order.phone_1 ? normalizePhone(order.phone_1) : null;
  if (phone) userData.ph = [sha256(phone)];
  const nameParts = order.customer_name?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (nameParts[0]) userData.fn = [sha256(nameParts[0])];
  if (nameParts.length > 1) userData.ln = [sha256(nameParts.slice(1).join(" "))];
  const city = order.governorate?.trim().toLowerCase().replace(/[^\p{L}]/gu, "");
  if (city) userData.ct = [sha256(city)];
  userData.country = [sha256("eg")];
  const externalId = context?.external_id ?? (order.user_id ? sha256(order.user_id) : null);
  if (externalId) userData.external_id = [externalId];
  // These four are sent in the clear, as Meta requires.
  if (context?.client_ip) userData.client_ip_address = context.client_ip;
  if (context?.client_user_agent) userData.client_user_agent = context.client_user_agent;
  if (context?.fbp) userData.fbp = context.fbp;
  if (context?.fbc) userData.fbc = context.fbc;
  return userData;
}

// Graph API error codes that are temporary (rate limits / transient server errors).
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 368, 613, 80004]);
// Auth/config errors: the event is fine, the setup isn't. Retry later so it
// recovers once the token/permissions are fixed.
const CONFIG_CODES = new Set([10, 102, 190, 200, 299]);

export async function sendMetaEvent(event: MetaEvent): Promise<MetaSendResult> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token || !META_PIXEL_ID) return { ok: false, retryable: true, reason: "NOT_CONFIGURED" };

  // The token travels in the JSON body (supported by the Graph API), never in the URL.
  const body = JSON.stringify({
    data: [event],
    access_token: token,
    ...(process.env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE } : {}),
  });

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok) return { ok: true };

    let code: number | null = null;
    try {
      const parsed = await response.json() as { error?: { code?: number } };
      code = typeof parsed.error?.code === "number" ? parsed.error.code : null;
    } catch { /* non-JSON error body */ }

    const reason = `HTTP_${response.status}${code !== null ? `_CODE_${code}` : ""}`;
    console.error("[meta-capi] event rejected:", reason);
    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      response.status === 401 ||
      response.status === 403 ||
      (code !== null && (TRANSIENT_CODES.has(code) || CONFIG_CODES.has(code)));
    return { ok: false, retryable, reason };
  } catch (error) {
    // Only the error name is logged: fetch errors can embed request details.
    const name = error instanceof Error ? error.name : "unknown";
    console.error("[meta-capi] event send failed:", name);
    return { ok: false, retryable: true, reason: name === "TimeoutError" || name === "AbortError" ? "TIMEOUT" : "NETWORK" };
  }
}
