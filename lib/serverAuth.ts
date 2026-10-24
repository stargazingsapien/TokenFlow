import { SESSION_COOKIE } from "@/lib/auth";
import { firebaseAuthAdmin } from "@/lib/firebaseAdmin";

const allowedStaffEmails = new Set(
  (process.env.TOKENFLOW_STAFF_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export function isAllowedStaffEmail(email: string | undefined | null) {
  return Boolean(email && allowedStaffEmails.has(email.trim().toLowerCase()));
}

export async function isStaffRequest(request: Request) {
  if (!firebaseAuthAdmin) return false;
  const sessionCookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!sessionCookie) return false;

  try {
    const session = await firebaseAuthAdmin.verifySessionCookie(sessionCookie, true);
    return isAllowedStaffEmail(session.email);
  } catch {
    return false;
  }
}
