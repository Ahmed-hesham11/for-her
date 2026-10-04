import { NextResponse, type NextRequest } from "next/server";
import { isAdminRole } from "@/lib/admin/roles";
import { ADMIN_SESSION_HEADER, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isUnauthorizedRoute = pathname === "/admin/unauthorized";

  if (!isAdminRoute || isUnauthorizedRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getSessionUser(token);

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAdminRole(user.role)) {
    return NextResponse.redirect(new URL("/admin/unauthorized", request.url));
  }

  // Forward the already-verified user so requireAdmin() (the dashboard
  // layout, admin print pages, every admin Server Action) doesn't repeat
  // the same session+profile lookup this request already did.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ADMIN_SESSION_HEADER, JSON.stringify(user));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/admin/:path*"],
};
