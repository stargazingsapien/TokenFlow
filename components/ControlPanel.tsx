"use client";

import { useQueue } from "./QueueProvider";
import { StatusPill } from "./StatusPill";
import { useI18n } from "./I18nProvider";
import { useEffect, useMemo, useState } from "react";

const clickerKeys = new Set([" ", "Enter", "ArrowRight", "n", "N"]);

export function ControlPanel() {
  const { queue, issue, next, skip, reset, saveSettings } = useQueue();
  const { t } = useI18n();
  const [clinicName, setClinicName] = useState(queue.clinicName);
  const [doctorName, setDoctorName] = useState(queue.doctorName);
  const [avgConsultMinutes, setAvgConsultMinutes] = useState(queue.avgConsultMinutes);
  const waitingCount = Math.max(queue.totalIssued - queue.currentToken, 0);
  const canAdvance = queue.currentToken < queue.totalIssued;

  useEffect(() => {
    setClinicName(queue.clinicName);
    setDoctorName(queue.doctorName);
    setAvgConsultMinutes(queue.avgConsultMinutes);
  }, [queue.avgConsultMinutes, queue.clinicName, queue.doctorName]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (!clickerKeys.has(event.key)) return;
      event.preventDefault();
      next();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next]);

  const lastTokens = useMemo(() => queue.tokens.slice(-12).reverse(), [queue.tokens]);

  return (
    <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-lg border border-white/70 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-mint">{t("controlRoom")}</p>
            <h1 className="mt-2 text-3xl font-black text-ink sm:text-5xl">{queue.clinicName}</h1>
            <p className="mt-2 text-slate-600">
              {t("doctor")}: {queue.doctorName}
            </p>
          </div>
          <div className="rounded-lg bg-slatepanel px-5 py-4 text-white">
            <p className="text-sm font-semibold text-slate-200">{t("nowServing")}</p>
            <p className="text-6xl font-black leading-none">#{queue.currentToken}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Metric label={t("issued")} value={queue.totalIssued} />
          <Metric label={t("waiting")} value={waitingCount} />
          <Metric label={t("avgMins")} value={queue.avgConsultMinutes} />
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_1.4fr_1fr]">
          <button
            onClick={issue}
            className="rounded-lg bg-ink px-5 py-5 text-xl font-black text-white transition hover:bg-slatepanel"
          >
            {t("issueToken")}
          </button>
          <button
            onClick={next}
            disabled={!canAdvance}
            className="rounded-lg bg-mint px-5 py-7 text-3xl font-black text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {t("next")}
          </button>
          <button
            onClick={skip}
            className="rounded-lg bg-coral px-5 py-5 text-xl font-black text-white transition hover:brightness-95"
          >
            {t("skip")}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-cloud p-4">
          <p className="text-sm font-semibold text-slate-600">
            {t("clickerKeys")}
          </p>
          <button
            onClick={reset}
            className="rounded-md border border-coral px-4 py-2 text-sm font-black text-coral transition hover:bg-coral hover:text-white"
          >
            {t("resetDay")}
          </button>
        </div>
      </div>

      <div className="grid gap-5">
        <form
          className="rounded-lg border border-white/70 bg-white p-5 shadow-panel"
          onSubmit={(event) => {
            event.preventDefault();
            saveSettings({ clinicName, doctorName, avgConsultMinutes });
          }}
        >
          <h2 className="text-xl font-black text-ink">{t("clinicSetup")}</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-bold text-slate-600">
              {t("clinicName")}
              <input
                value={clinicName}
                onChange={(event) => setClinicName(event.target.value)}
                className="rounded-md border border-slate-200 px-3 py-3 text-ink"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-600">
              {t("doctorName")}
              <input
                value={doctorName}
                onChange={(event) => setDoctorName(event.target.value)}
                className="rounded-md border border-slate-200 px-3 py-3 text-ink"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-600">
              {t("averageConsultationMinutes")}
              <input
                type="number"
                min={1}
                max={60}
                value={avgConsultMinutes}
                onChange={(event) => setAvgConsultMinutes(Number(event.target.value))}
                className="rounded-md border border-slate-200 px-3 py-3 text-ink"
              />
            </label>
          </div>
          <button className="mt-4 w-full rounded-lg bg-amberline px-4 py-3 font-black text-ink">
            {t("saveSetup")}
          </button>
        </form>

        <div className="rounded-lg border border-white/70 bg-white p-5 shadow-panel">
          <h2 className="text-xl font-black text-ink">{t("recentTokens")}</h2>
          <div className="mt-4 grid gap-2">
            {lastTokens.length === 0 ? (
              <p className="rounded-lg bg-cloud p-4 text-sm font-semibold text-slate-500">
                {t("noTokensIssued")}
              </p>
            ) : (
              lastTokens.map((token) => (
                <div
                  key={token.tokenNumber}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
                >
                  <span className="text-lg font-black">#{token.tokenNumber}</span>
                  <StatusPill status={token.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-cloud p-4">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-4xl font-black text-ink">{value}</p>
    </div>
  );
}
