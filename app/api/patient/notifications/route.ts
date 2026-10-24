import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { clinicId } from "@/lib/firebase";
import { firestoreAdmin } from "@/lib/firebaseAdmin";
import type { QueueState } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupportedLanguage = "en" | "gu" | "hi";

export async function POST(request: Request) {
  if (!clinicId || !firestoreAdmin) {
    return NextResponse.json({ message: "Push notifications are not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    tokenNumber?: number;
    accessKey?: string;
    fcmToken?: string;
    language?: SupportedLanguage;
  } | null;
  const tokenNumber = Number(body?.tokenNumber);
  const accessKey = String(body?.accessKey ?? "");
  const fcmToken = String(body?.fcmToken ?? "").trim();
  const language = isSupportedLanguage(body?.language) ? body.language : "en";

  if (
    !Number.isInteger(tokenNumber) ||
    tokenNumber < 1 ||
    !accessKey ||
    fcmToken.length < 20 ||
    fcmToken.length > 4096
  ) {
    return NextResponse.json({ message: "A valid patient tracker and notification token are required." }, { status: 400 });
  }

  const queueRef = firestoreAdmin.doc(`clinics/${clinicId}/private/queueState`);
  let state: QueueState | undefined;
  try {
    state = (await queueRef.get()).data()?.state as QueueState | undefined;
  } catch {
    return NextResponse.json({ message: "Unable to verify the patient tracker." }, { status: 500 });
  }

  const patientToken = state?.tokens.find((item) => item.tokenNumber === tokenNumber);
  if (!state || !patientToken || !matchesAccessKey(patientToken.patientAccessKey ?? "", accessKey)) {
    return NextResponse.json({ message: "Private tracker link is invalid." }, { status: 404 });
  }

  try {
    await firestoreAdmin
      .doc(`clinics/${clinicId}/private/queueState/pushSubscriptions/${tokenNumber}`)
      .set({ tokenNumber, accessKey, fcmToken, language, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ message: "Unable to save this device's notification subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "en" || value === "gu" || value === "hi";
}

function matchesAccessKey(savedKey: string, suppliedKey: string) {
  const saved = Buffer.from(savedKey);
  const supplied = Buffer.from(suppliedKey);
  return saved.length === supplied.length && saved.length > 0 && timingSafeEqual(saved, supplied);
}
