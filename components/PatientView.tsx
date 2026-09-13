"use client";

import { estimateWaitMinutes } from "@/lib/queue";
import { useQueue } from "./QueueProvider";
import { useI18n } from "./I18nProvider";
import { useMemo, useState } from "react";

export function PatientView({ initialToken }: { initialToken: number }) {
  const { queue, isReady } = useQueue();
  const { t } = useI18n();
  const [token, setToken] = useState(initialToken || 1);
  const status = queue.tokens.find((item) => item.tokenNumber === token)?.status ?? "WAITING";
  const peopleAhead = Math.max(token - queue.currentToken - 1, 0);
  const waitMinutes = estimateWaitMinutes(queue, token);

  const message = useMemo(() => {
    if (status === "SERVING" || token === queue.currentToken) return t("proceedMessage");
    if (token < queue.currentToken || status === "COMPLETED") return t("alreadyCalledMessage");
    if (status === "SKIPPED") return t("skippedMessage");
    return t("waitingMessage");
  }, [queue.currentToken, status, t, token]);

  return (
    <section className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-lg border border-white/70 bg-white p-5 shadow-panel">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-mint">{t("patientTracker")}</p>
        <h1 className="mt-3 text-4xl font-black text-ink">{queue.clinicName}</h1>
        <p className="mt-2 text-slate-600">
          {t("doctor")}: {queue.doctorName}
        </p>

        <label className="mt-8 grid gap-2 text-sm font-bold text-slate-600">
          {t("yourTokenNumber")}
          <input
            type="number"
            min={1}
            value={token}
            onChange={(event) => setToken(Number(event.target.value))}
            className="rounded-lg border border-slate-200 px-4 py-4 text-3xl font-black text-ink"
          />
        </label>
      </div>

      <div className="rounded-lg border border-white/70 bg-white p-6 shadow-panel">
        <div className="grid gap-4 sm:grid-cols-2">
          <TokenCard label={t("nowServing")} value={queue.currentToken} tone="dark" />
          <TokenCard label={t("yourToken")} value={token} tone="light" />
        </div>

        <div className="mt-5 rounded-lg bg-cloud p-5">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{t("estimatedWait")}</p>
          <p className="mt-2 text-6xl font-black text-ink">
            {waitMinutes} {t("min")}
          </p>
          <p className="mt-2 text-base font-semibold text-slate-600">
            {peopleAhead} {peopleAhead === 1 ? t("patientSingular") : t("patientPlural")} {t("ahead")}
          </p>
        </div>

        <div className="mt-5 rounded-lg border border-mint/20 bg-mint/10 p-5">
          <p className="text-xl font-black text-ink">{message}</p>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            {t("lastUpdated")}{" "}
            {isReady
              ? new Date(queue.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : t("syncing")}
          </p>
        </div>
      </div>
    </section>
  );
}

function TokenCard({ label, value, tone }: { label: string; value: number; tone: "dark" | "light" }) {
  const className =
    tone === "dark"
      ? "bg-slatepanel text-white"
      : "border border-slate-200 bg-white text-ink";

  return (
    <div className={`rounded-lg p-5 ${className}`}>
      <p className="text-sm font-bold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-3 text-7xl font-black leading-none">#{value}</p>
    </div>
  );
}
