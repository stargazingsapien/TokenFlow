import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { SESSION_COOKIE, isStaffSession } from "@/lib/auth";
import { defaultQueueState } from "@/lib/queue";
import type { QueueState } from "@/lib/queue";
import { clinicId } from "@/lib/firebase";
import { firestoreAdmin } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isStaffRequest(request)) {
    return NextResponse.json({ message: "Staff login required." }, { status: 401 });
  }
  if (!clinicId || !firestoreAdmin) {
    return NextResponse.json({ message: "Live queue sync is not configured." }, { status: 503 });
  }

  let snapshot;
  try {
    snapshot = await firestoreAdmin.doc(`clinics/${clinicId}/private/queueState`).get();
  } catch {
    return NextResponse.json({ message: "Unable to load the clinic queue." }, { status: 500 });
  }
  const savedState = snapshot.data()?.state;
  if (!savedState) return NextResponse.json(null, { headers: { "Cache-Control": "no-store" } });

  const state = savedState as QueueState;
  let didMigrate = false;
  state.tokens = state.tokens.map((token) => {
    if (token.patientAccessKey) return token;
    didMigrate = true;
    return { ...token, patientAccessKey: randomUUID() };
  });
  if (didMigrate) {
    try {
      const updatedAt = new Date().toISOString();
      await firestoreAdmin.doc(`clinics/${clinicId}/private/queueState`).set({ state, updatedAt });
      await firestoreAdmin.doc(`clinics/${clinicId}/public/queueSignal`).set({ revision: Date.now(), updatedAt });
    } catch {
      return NextResponse.json({ message: "Unable to secure patient tracker links." }, { status: 500 });
    }
  }
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isStaffRequest(request)) {
    return NextResponse.json({ message: "Staff login required." }, { status: 401 });
  }
  if (!clinicId || !firestoreAdmin) {
    return NextResponse.json({ message: "Live queue sync is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as QueueState | null;
  if (!body || !Array.isArray(body.tokens) || !Number.isFinite(body.totalIssued)) {
    return NextResponse.json({ message: "Invalid queue state." }, { status: 400 });
  }

  const state: QueueState = {
    ...defaultQueueState,
    ...body,
    tokens: body.tokens.map((token) => ({
      ...token,
      patientName: String(token.patientName ?? `Patient #${token.tokenNumber}`),
      patientPhone: token.patientPhone ? String(token.patientPhone) : undefined,
      patientAccessKey: token.patientAccessKey || randomUUID()
    }))
  };
  const updatedAt = new Date().toISOString();
  try {
    await firestoreAdmin.doc(`clinics/${clinicId}/private/queueState`).set({ state, updatedAt });
    await firestoreAdmin.doc(`clinics/${clinicId}/public/queueSignal`).set({ revision: Date.now(), updatedAt });
  } catch {
    return NextResponse.json({ message: "Unable to save the clinic queue." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
}

function isStaffRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const session = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return isStaffSession(session);
}
