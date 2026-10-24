import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "./lib/auth";

const protectedRoutes = ["/control", "/display"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  // Middleware only routes based on cookie presence; every protected API verifies
  // the signed Firebase session cookie with Firebase Admin.
  const isLoggedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

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
