import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isStaffRequest } from "@/lib/serverAuth";
import { applyQueueAction, defaultQueueState } from "@/lib/queue";
import type { QueueAction, QueueState } from "@/lib/queue";
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
  const adminDb = firestoreAdmin;

  let result;
  try {
    result = await adminDb.runTransaction(async (transaction) => {
      const queueRef = adminDb.doc(`clinics/${clinicId}/private/queueState`);
      const signalRef = adminDb.doc(`clinics/${clinicId}/public/queueSignal`);
      const snapshot = await transaction.get(queueRef);
      const savedState = snapshot.data()?.state as QueueState | undefined;
      if (!savedState) return { state: null as QueueState | null };

      const state = normalizeQueueState(savedState);
      const needsMigration = Array.isArray(savedState.tokens) && savedState.tokens.some((token) => !token.patientAccessKey);
      if (needsMigration) {
        state.syncRevision = savedState.syncRevision ?? 0;
        transaction.set(queueRef, { state, updatedAt: state.updatedAt });
        transaction.set(signalRef, { revision: Date.now(), updatedAt: state.updatedAt });
      }
      return { state };
    });
  } catch {
    return NextResponse.json({ message: "Unable to load the clinic queue." }, { status: 500 });
  }
  return NextResponse.json(result.state, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!(await isStaffRequest(request))) {
    return NextResponse.json({ message: "Staff login required." }, { status: 401 });
  }
  if (!clinicId || !firestoreAdmin) {
    return NextResponse.json({ message: "Live queue sync is not configured." }, { status: 503 });
  }
  const adminDb = firestoreAdmin;

  const body = await request.json().catch(() => null) as { action?: QueueAction } & Partial<QueueState> | null;
  const isLegacySnapshot = Boolean(body && !body.action && Array.isArray(body.tokens));
  const action = body?.action ?? (isLegacySnapshot ? { type: "initialize", state: body as QueueState } : null);
  if (!action || !isValidAction(action)) {
    return NextResponse.json({ message: "Invalid queue action." }, { status: 400 });
  }

  let transactionResult: { state: QueueState; previousState?: QueueState; created: boolean };
  try {
    transactionResult = await adminDb.runTransaction(async (transaction) => {
      const queueRef = adminDb.doc(`clinics/${clinicId}/private/queueState`);
      const signalRef = adminDb.doc(`clinics/${clinicId}/public/queueSignal`);
      const snapshot = await transaction.get(queueRef);
      const savedState = snapshot.data()?.state as QueueState | undefined;

      if (action.type === "initialize" && savedState) {
        return { state: normalizeQueueState(savedState), previousState: savedState, created: false };
      }

      const previousState = savedState ? normalizeQueueState(savedState) : undefined;
      let nextState: QueueState;
      if (action.type === "initialize") {
        nextState = normalizeQueueState(action.state);
      } else if (action.type === "reconcile") {
        const localState = normalizeQueueState(action.localState);
        const existingTokenNumbers = new Set((previousState?.tokens ?? []).map((token) => token.tokenNumber));
        const missingTokens = localState.tokens.filter(
          (token) => token.tokenNumber > (previousState?.totalIssued ?? 0) &&
            token.tokenNumber <= localState.totalIssued && !existingTokenNumbers.has(token.tokenNumber)
        );
        const mayRestoreLegacyQueue = Boolean(
          savedState && (savedState.syncRevision ?? 0) === 0 && action.localState.syncRevision === undefined &&
          localState.totalIssued > (previousState?.totalIssued ?? 0) &&
          Date.parse(localState.updatedAt) > Date.parse(previousState?.updatedAt ?? "") &&
          missingTokens.length > 0
        );
        if (!mayRestoreLegacyQueue || !previousState) {
          return { state: previousState ?? defaultQueueState, previousState: savedState, created: false };
        }
        nextState = {
          ...previousState,
          totalIssued: Math.max(previousState.totalIssued, localState.totalIssued),
          tokens: [...previousState.tokens, ...missingTokens],
          updatedAt: new Date().toISOString(),
          syncRevision: 1
        };
      } else {
        nextState = applyQueueAction(previousState ?? defaultQueueState, action);
      }

      if (action.type !== "reconcile") {
        nextState.syncRevision = (previousState?.syncRevision ?? 0) + 1;
      }
      transaction.set(queueRef, { state: nextState, updatedAt: nextState.updatedAt });
      transaction.set(signalRef, { revision: nextState.syncRevision, updatedAt: nextState.updatedAt });
      return { state: nextState, previousState, created: true };
    });
  } catch {
    return NextResponse.json({ message: "Unable to save the clinic queue." }, { status: 500 });
  }

  if (isLegacySnapshot && !transactionResult.created) {
    return NextResponse.json(
      { message: "Legacy queue snapshot rejected; refresh to load the shared queue.", state: transactionResult.state },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { state, previousState } = transactionResult;
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

function normalizeQueueState(state: QueueState): QueueState {
  return {
    ...defaultQueueState,
    ...state,
    syncRevision: state.syncRevision ?? 0,
    tokens: (Array.isArray(state.tokens) ? state.tokens : []).map((token) => ({
      ...token,
      patientName: String(token.patientName ?? `Patient #${token.tokenNumber}`),
      patientPhone: token.patientPhone ? String(token.patientPhone) : undefined,
      patientAccessKey: token.patientAccessKey || randomUUID()
    }))
  };
}

function isValidAction(action: QueueAction): boolean {
  if (!action || typeof action !== "object" || !("type" in action)) return false;
  switch (action.type) {
    case "initialize":
      return Boolean(action.state && Array.isArray(action.state.tokens) && Number.isInteger(action.state.totalIssued));
    case "reconcile":
      return Boolean(action.localState && Array.isArray(action.localState.tokens) && Number.isInteger(action.localState.totalIssued));
    case "issue":
      return (action.patientName === undefined || typeof action.patientName === "string") &&
        (action.patientPhone === undefined || typeof action.patientPhone === "string") &&
        (action.patientAccessKey === undefined || typeof action.patientAccessKey === "string");
    case "next":
    case "complete":
    case "reset":
      return true;
    case "callSpecific":
    case "requeue":
    case "cancel":
      return Number.isInteger(action.tokenNumber) && action.tokenNumber > 0;
    case "skip":
      return action.tokenNumber === undefined || (Number.isInteger(action.tokenNumber) && action.tokenNumber > 0);
    case "settings":
      return typeof action.settings?.clinicName === "string" &&
        typeof action.settings?.doctorName === "string" &&
        Number.isFinite(action.settings?.avgConsultMinutes) && action.settings.avgConsultMinutes > 0;
    default:
      return false;
  }
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
