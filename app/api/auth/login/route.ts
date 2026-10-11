import { NextResponse } from "next/server";
import { hashPassword, isLegacyPasswordHash, verifyAgainstDummyHash, verifyPassword } from "@/lib/auth/password";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/auth/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";

const GENERIC_ERROR = "Invalid phone number or password.";

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone_1 === "string" ? normalizePhone(body.phone_1) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!phone || !password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, role, password_hash")
    .eq("phone_1", phone)
    .maybeSingle();

  if (!profile) {
    // Run a real verify() against a dummy hash so a nonexistent account
    // takes the same time as a wrong password — no user-enumeration oracle.
    await verifyAgainstDummyHash(password);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const isValid = await verifyPassword(password, profile.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (isLegacyPasswordHash(profile.password_hash)) {
    const passwordHash = await hashPassword(password);
    await supabaseAdmin.from("profiles").update({ password_hash: passwordHash }).eq("id", profile.id);
  }

  const token = await createSession(profile.id);
  const response = NextResponse.json({
    user: { id: profile.id, full_name: profile.full_name, email: profile.email, role: profile.role },
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(30 * 24 * 60 * 60));
  return response;
}
