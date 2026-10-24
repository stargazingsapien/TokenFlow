import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { isAllowedStaffEmail } from "@/lib/serverAuth";
import { firebaseAuthAdmin } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!firebaseAuthAdmin) {
    return NextResponse.json({ error: "Firebase Authentication is not configured." }, { status: 503 });
  }

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { idToken?: string } | null;
  if (!body?.idToken) {
    return NextResponse.json({ error: "A Firebase ID token is required." }, { status: 400 });
  }

  try {
    const decodedToken = await firebaseAuthAdmin.verifyIdToken(body.idToken, true);
    const authAgeSeconds = Date.now() / 1000 - decodedToken.auth_time;
    if (authAgeSeconds < 0 || authAgeSeconds > 5 * 60 || !isAllowedStaffEmail(decodedToken.email)) {
      return NextResponse.json({ error: "This account is not authorized for staff access." }, { status: 401 });
    }

    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    const sessionCookie = await firebaseAuthAdmin.createSessionCookie(body.idToken, { expiresIn });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: expiresIn / 1000,
      expires: new Date(Date.now() + expiresIn)
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
}
