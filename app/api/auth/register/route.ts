import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { isValidPhone, isValidPassword, normalizePhone, MIN_PASSWORD_LENGTH } from "@/lib/auth/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const phone = typeof body?.phone_1 === "string" ? normalizePhone(body.phone_1) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!fullName) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("phone_1", phone).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "An account with this phone number already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  // Governorate/address are collected later on the Account page (schema
  // requires them NOT NULL) — empty strings, never invented data. email is
  // no longer collected at signup — phone_1 is the account identifier now.
  const { data: profile, error: insertError } = await supabaseAdmin
    .from("profiles")
    .insert({
      full_name: fullName,
      email: null,
      password_hash: passwordHash,
      phone_1: phone,
      phone_2: null,
      governorate: "",
      address: "",
      role: "customer",
    })
    .select("id, full_name, email, role")
    .single();

  if (insertError || !profile) {
    return NextResponse.json({ error: "Unable to create your account right now." }, { status: 500 });
  }

  const token = await createSession(profile.id);
  const response = NextResponse.json({ user: profile });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(30 * 24 * 60 * 60));
  return response;
}
