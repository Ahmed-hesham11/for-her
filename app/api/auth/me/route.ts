import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const user = await getSessionUser(token);
  return NextResponse.json({ user });
}
