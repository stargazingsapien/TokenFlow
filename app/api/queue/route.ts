import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isStaffRequest } from "@/lib/serverAuth";
import { defaultQueueState } from "@/lib/queue";
import type { QueueState } from "@/lib/queue";
import { clinicId } from "@/lib/firebase";
import { firebaseMessagingAdmin, firestoreAdmin } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isStaffRequest(request))) {
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
  if (!(await isStaffRequest(request))) {
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
  let previousState: QueueState | undefined;
  try {
    previousState = (await firestoreAdmin.doc(`clinics/${clinicId}/private/queueState`).get()).data()?.state as QueueState | undefined;
  } catch {
    return NextResponse.json({ message: "Unable to check the previous clinic queue." }, { status: 500 });
  }
  const updatedAt = new Date().toISOString();
  try {
    await firestoreAdmin.doc(`clinics/${clinicId}/private/queueState`).set({ state, updatedAt });
    await firestoreAdmin.doc(`clinics/${clinicId}/public/queueSignal`).set({ revision: Date.now(), updatedAt });
  } catch {
    return NextResponse.json({ message: "Unable to save the clinic queue." }, { status: 500 });
  }
  if (
    state.lastCalledAt &&
    state.lastCalledAt !== previousState?.lastCalledAt &&
    state.lastCalledToken &&
    firebaseMessagingAdmin
  ) {
    await notifyPatientOfTheirTurn(request, state, state.lastCalledToken);
  }
  return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
}

async function notifyPatientOfTheirTurn(request: Request, state: QueueState, tokenNumber: number) {
  if (!clinicId || !firestoreAdmin || !firebaseMessagingAdmin) return;
  const patientToken = state.tokens.find((item) => item.tokenNumber === tokenNumber);
  if (!patientToken?.patientAccessKey) return;

  const subscriptionRef = firestoreAdmin.doc(
    `clinics/${clinicId}/private/queueState/pushSubscriptions/${tokenNumber}`
  );
  try {
    const subscriptionSnapshot = await subscriptionRef.get();
    const subscription = subscriptionSnapshot.data() as {
      accessKey?: string;
      fcmToken?: string;
      language?: "en" | "gu" | "hi";
    } | undefined;
    if (
      !subscription?.fcmToken ||
      subscription.accessKey !== patientToken.patientAccessKey
    ) return;

    const copy = notificationCopy(subscription.language ?? "en", tokenNumber);
    const trackerLink = new URL(`/patient?token=${tokenNumber}#${encodeURIComponent(patientToken.patientAccessKey)}`, request.url).href;
    await firebaseMessagingAdmin.send({
      token: subscription.fcmToken,
      notification: { title: copy.title, body: copy.body },
      data: { url: trackerLink, tokenNumber: String(tokenNumber) }
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "unknown";
    console.warn("[TokenFlow push] Unable to notify patient", { tokenNumber, code });
  }
}

function notificationCopy(language: "en" | "gu" | "hi", tokenNumber: number) {
  if (language === "gu") {
    return {
      title: "તમારો વારો આવી ગયો છે",
      body: `ટોકન #${tokenNumber} બોલાવવામાં આવી રહ્યું છે. ટ્રેકર ખોલવા માટે ટૅપ કરો.`
    };
  }
  if (language === "hi") {
    return {
      title: "आपकी बारी आ गई है",
      body: `टोकन #${tokenNumber} बुलाया जा रहा है। ट्रैकर खोलने के लिए टैप करें।`
    };
  }
  return {
    title: "Your turn is here",
    body: `Token #${tokenNumber} is being called. Tap to open your tracker.`
  };
}
