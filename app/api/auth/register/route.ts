import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { isValidEmail, isValidPassword, normalizeEmail, MIN_PASSWORD_LENGTH } from "@/lib/auth/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!fullName) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  // Phone/governorate/address are collected later on the Account page
  // (schema requires them NOT NULL) — empty strings, never invented data.
  const { data: profile, error: insertError } = await supabaseAdmin
    .from("profiles")
    .insert({
      full_name: fullName,
      email,
      password_hash: passwordHash,
      phone_1: "",
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
