"use client";

import { estimateDynamicWait } from "@/lib/queue";
import { useI18n } from "./I18nProvider";
import { useQueue } from "./QueueProvider";
import { StatusPill } from "./StatusPill";
import { useEffect, useMemo, useState } from "react";

export function PatientView({ initialToken }: { initialToken: number }) {
  const { queue, stats, isReady } = useQueue();
  const { t } = useI18n();
  const [tokenNumber, setTokenNumber] = useState<number>(initialToken || 1);

  // Find the patient's specific token record
  const tokenRecord = useMemo(
    () => queue.tokens.find((item) => item.tokenNumber === tokenNumber),
    [queue.tokens, tokenNumber]
  );

  const status = tokenRecord?.status ?? "WAITING";
  const patientName = tokenRecord?.patientName ?? `Patient #${tokenNumber}`;

  // Dynamic wait time calculation for this patient
  const dynamicWait = useMemo(
    () => estimateDynamicWait(queue, tokenNumber),
    [queue, tokenNumber]
  );

  const servingToken = stats.servingToken;
  const isCurrentlyServingMe = servingToken?.tokenNumber === tokenNumber;

  // Sound alert on mobile when patient's turn arrives!
  useEffect(() => {
    if (isCurrentlyServingMe) {
      if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch {
          // Best effort vibration
        }
      }
    }
  }, [isCurrentlyServingMe]);

  const message = useMemo(() => {
    if (!tokenRecord) {
      return t("tokenNotFound");
    }
    if (isCurrentlyServingMe) {
      return t("proceedMessage");
    }
    if (status === "COMPLETED") {
      return t("alreadyCalledMessage");
    }
    if (status === "SKIPPED") {
      return t("skippedMessage");
    }
    if (status === "CANCELLED") {
      return t("cancelledMessage");
    }
    return t("waitingMessage");
  }, [isCurrentlyServingMe, status, t, tokenRecord]);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      {/* Read-Only Notice Badge */}
      <div className="flex items-center justify-between rounded-xl border border-blue-200/60 bg-blue-50/80 px-4 py-2.5 text-xs font-semibold text-blue-800">
        <span className="flex items-center gap-1.5">
          <span>{t("patientReadOnlyNotice")}</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Synced
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        {/* Left Column: Token Selector & Clinic Info */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-widest text-mint">
              {t("patientTracker")}
            </span>
            <h1 className="mt-2 text-3xl font-black text-ink">{queue.clinicName}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {t("doctor")}: <span className="font-bold text-ink">{queue.doctorName}</span>
            </p>

            {/* Token Selector (Read-Only Search / Entry) */}
            <div className="mt-6 rounded-xl bg-slate-50 p-4 border border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("yourTokenNumber")}
              </label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-2xl font-black text-slate-400">#</span>
                <input
                  type="number"
                  min={1}
                  value={tokenNumber}
                  onChange={(e) => setTokenNumber(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-2xl font-black text-ink shadow-sm focus:border-mint focus:outline-none"
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {t("yourTokenNumber")}
              </p>
            </div>

            {/* Patient Name Attached to Token */}
            <div className="mt-4 rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t("patientName")}
              </p>
              <p className="mt-1 text-xl font-black text-ink">{patientName}</p>
              <div className="mt-2">
                {tokenRecord ? (
                  <StatusPill status={status} />
                ) : (
                  <p className="text-sm font-semibold text-rose-700">{t("tokenNotFound")}</p>
                )}
              </div>
            </div>
          </div>

          {/* OPD Queue Status Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("liveOpdQueue")} Summary
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">{t("waiting")}</p>
                <p className="text-2xl font-black text-ink">{stats.waitingCount}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">{t("completedCheckups")}</p>
                <p className="text-2xl font-black text-emerald-700">{stats.completedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Status & Dynamic Wait Time */}
        <div className="space-y-5">
          {/* Turn Calling Banner (Big Visual Attention Grabber) */}
          {isCurrentlyServingMe ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-sm">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-2xl font-black">{t("proceedMessage")}</h2>
                  <p className="text-sm font-semibold text-emerald-800">
                    Token #{tokenNumber} · {patientName}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Dual Cards: Now Serving vs Your Token */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-amberline">
                {t("nowServing")}
              </p>
              <p className="mt-2 text-6xl font-black leading-none">
                #{servingToken?.tokenNumber ?? "--"}
              </p>
              <p className="mt-3 truncate text-sm font-semibold text-slate-300">
                {servingToken?.patientName ?? t("roomReady")}
              </p>
            </div>

            <div
              className={`rounded-2xl border p-6 shadow-panel ${
                isCurrentlyServingMe
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-slate-200 bg-white text-ink"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-widest opacity-70">
                {t("yourToken")}
              </p>
              <p className="mt-2 text-6xl font-black leading-none">#{tokenNumber}</p>
              <p className="mt-3 truncate text-sm font-bold opacity-80">{patientName}</p>
            </div>
          </div>

          {/* Dynamic Estimated Wait Time Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {t("dynamicWait")}
              </p>
              <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                <span>Auto-Updated</span>
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-6xl font-black text-ink">{tokenRecord ? dynamicWait.waitMinutes : "—"}</span>
              <span className="text-xl font-bold text-slate-500">{t("min")}</span>
            </div>

            <p className="mt-2 text-sm font-semibold text-slate-600">
              {!tokenRecord ? (
                <span className="font-bold text-rose-700">{t("tokenNotFound")}</span>
              ) : status === "WAITING" ? (
                <>
                  <span className="font-bold text-ink">{dynamicWait.patientsAhead}</span>{" "}
                  {dynamicWait.patientsAhead === 1 ? t("patientSingular") : t("patientPlural")}{" "}
                  {t("ahead")}
                </>
              ) : isCurrentlyServingMe ? (
                <span className="font-bold text-emerald-700">
                  Currently in Doctor&apos;s Room
                </span>
              ) : (
                <span className="font-bold text-slate-500">Checkup {status.toLowerCase()}</span>
              )}
            </p>

            {/* Dynamic Overtime Notice */}
            {dynamicWait.isOvertime && status === "WAITING" && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs font-medium text-amber-900">
                {t("dynamicWaitTooltip")}
              </div>
            )}
          </div>

          {/* Patient Instruction Alert */}
          <div
            className={`rounded-2xl border p-5 transition ${
              isCurrentlyServingMe
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : status === "SKIPPED"
                ? "border-orange-300 bg-orange-50 text-orange-900"
                : status === "CANCELLED"
                ? "border-rose-300 bg-rose-50 text-rose-900"
                : "border-mint/30 bg-mint/10 text-ink"
            }`}
          >
            <p className="text-lg font-black">{message}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>
                {t("lastUpdated")}:{" "}
                {isReady
                  ? new Date(queue.updatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : t("syncing")}
              </span>
              <span>Read-only</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
