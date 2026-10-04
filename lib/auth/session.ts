import { supabaseAdmin } from "@/lib/supabase/admin";

// Edge-safe: only Web Crypto + a fetch-based Supabase client (no Node-only
// APIs), so this module can be imported from middleware.ts. Keep it free of
// lib/auth/password.ts's argon2 import for the same reason.

export const SESSION_COOKIE = "forher_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// Sliding expiration: only bump expires_at when at least this much of the
// session's life has already elapsed, so an active user doesn't cause a
// database write on every single request.
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day

export type SessionProfile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

// middleware.ts already verifies the session (2 Supabase queries) for every
// /admin/:path* request before the route even renders. Forwarding the
// result through this request header lets requireAdmin() reuse it instead
// of repeating the same 2 queries — internal to the request pipeline only,
// never present on the actual response the browser receives, and always
// overwritten by middleware itself so a client can't forge it.
export const ADMIN_SESSION_HEADER = "x-admin-session-user";

export function parseAdminSessionHeader(value: string | null): SessionProfile | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed.id === "string" && typeof parsed.role === "string") return parsed as SessionProfile;
  } catch {
    // fall through
  }
  return null;
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

// Buffer isn't guaranteed available on the Edge runtime (middleware.ts runs
// there), so encoding uses only Web APIs (Uint8Array/btoa/TextEncoder).
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

// Returns the raw token to set as the cookie value — only the hash is ever
// persisted, so a leaked database row can't be replayed as a session.
export async function createSession(userId: string): Promise<string> {
  if (!supabaseAdmin) throw new Error("Supabase admin client is not configured.");

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  const { error } = await supabaseAdmin.from("sessions").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) throw error;
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<SessionProfile | null> {
  if (!token || !supabaseAdmin) return null;

  const tokenHash = await hashToken(token);

  const { data: session } = await supabaseAdmin
    .from("sessions")
    .select("id, user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin.from("sessions").delete().eq("id", session.id);
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", session.user_id)
    .maybeSingle();

  if (!profile) return null;

  const now = Date.now();
  const timeUntilExpiry = new Date(session.expires_at).getTime() - now;
  if (timeUntilExpiry < SESSION_DURATION_MS - SESSION_REFRESH_THRESHOLD_MS) {
    await supabaseAdmin
      .from("sessions")
      .update({ expires_at: new Date(now + SESSION_DURATION_MS).toISOString(), last_used_at: new Date(now).toISOString() })
      .eq("id", session.id);
  }

  return profile as SessionProfile;
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token || !supabaseAdmin) return;
  const tokenHash = await hashToken(token);
  await supabaseAdmin.from("sessions").delete().eq("token_hash", tokenHash);
}
