import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, STAFF_SESSION_VALUE } from "./lib/auth";

const protectedRoutes = ["/control", "/display"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isLoggedIn = request.cookies.get(SESSION_COOKIE)?.value === STAFF_SESSION_VALUE;

  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && isLoggedIn) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = request.nextUrl.searchParams.get("next") ?? "/control";
    nextUrl.search = "";
    return NextResponse.redirect(nextUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/control/:path*", "/display/:path*", "/login"]
};
