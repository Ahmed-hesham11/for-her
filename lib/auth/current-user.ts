import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE, type SessionProfile } from "@/lib/auth/session";

// For Server Components / Route Handlers only — uses next/headers, which
// isn't available on the Edge runtime. middleware.ts reads the request
// cookie directly instead and calls getSessionUser() itself.
export async function getCurrentUser(): Promise<SessionProfile | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}
