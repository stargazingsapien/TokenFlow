import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { clinicId } from "@/lib/firebase";
import { firestoreAdmin } from "@/lib/firebaseAdmin";
import { calculateDynamicStats, estimateDynamicWait } from "@/lib/queue";
import type { QueueState } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!clinicId || !firestoreAdmin) {
    return NextResponse.json({ message: "Live queue sync is not configured." }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { tokenNumber?: number; accessKey?: string } | null;
  const tokenNumber = Number(body?.tokenNumber);
  const accessKey = String(body?.accessKey ?? "");
  if (!Number.isInteger(tokenNumber) || tokenNumber < 1 || !accessKey) {
    return NextResponse.json({ message: "A private tracker link is required." }, { status: 400 });
  }

  let snapshot;
  try {
    snapshot = await firestoreAdmin.doc(`clinics/${clinicId}/private/queueState`).get();
  } catch {
    return NextResponse.json({ message: "Unable to load the live queue." }, { status: 500 });
  }
  const state = snapshot.data()?.state as QueueState | undefined;
  const token = state?.tokens.find((item) => item.tokenNumber === tokenNumber);
  if (!state || !token || !matchesAccessKey(token.patientAccessKey ?? "", accessKey)) {
    return NextResponse.json({ message: "Private tracker link is invalid." }, { status: 404 });
  }

  const stats = calculateDynamicStats(state);
  const wait = estimateDynamicWait(state, tokenNumber);
  const { patientPhone: _phone, patientAccessKey: _accessKey, notes: _notes, ...publicToken } = token;
  return NextResponse.json(
    {
      clinicName: state.clinicName,
      doctorName: state.doctorName,
      updatedAt: state.updatedAt,
      waitingCount: stats.waitingCount,
      completedCount: stats.completedCount,
      currentTokenNumber: state.currentToken,
      effectiveAvgMinutes: stats.effectiveAvgMinutes,
      servingStartedAt: stats.servingToken?.servedAt,
      token: publicToken,
      waitMinutes: wait.waitMinutes,
      patientsAhead: wait.patientsAhead,
      isOvertime: wait.isOvertime
    },
    { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }
  );
}

function matchesAccessKey(savedKey: string, suppliedKey: string) {
  const saved = Buffer.from(savedKey);
  const supplied = Buffer.from(suppliedKey);
  return saved.length === supplied.length && saved.length > 0 && timingSafeEqual(saved, supplied);
}
