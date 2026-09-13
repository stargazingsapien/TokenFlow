"use client";

import { useEffect, useMemo, useRef } from "react";
import { useI18n } from "./I18nProvider";
import { useQueue } from "./QueueProvider";

export function DisplayView() {
  const { queue } = useQueue();
  const { t } = useI18n();
  const lastTokenRef = useRef(queue.currentToken);
  const upcoming = useMemo(
    () =>
      queue.tokens
        .filter((token) => token.tokenNumber > queue.currentToken && token.status === "WAITING")
        .slice(0, 8),
    [queue.currentToken, queue.tokens]
  );

  useEffect(() => {
    if (queue.currentToken === lastTokenRef.current || queue.currentToken === 0) return;
    lastTokenRef.current = queue.currentToken;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.32);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.35);
  }, [queue.currentToken]);

  return (
    <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-7xl gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="flex flex-col justify-between rounded-lg bg-slatepanel p-8 text-white shadow-panel sm:p-10">
        <div>
          <p className="text-base font-bold uppercase tracking-[0.22em] text-amberline">{queue.clinicName}</p>
          <h1 className="mt-4 text-4xl font-black sm:text-6xl">{t("nowServing")}</h1>
        </div>

        <div className="py-10 text-center">
          <p className="text-[9rem] font-black leading-none sm:text-[14rem]">#{queue.currentToken}</p>
          <p className="mt-5 text-2xl font-semibold text-slate-200">
            {t("doctor")}: {queue.doctorName}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <DisplayMetric label={t("issued")} value={queue.totalIssued} />
          <DisplayMetric label={t("waiting")} value={Math.max(queue.totalIssued - queue.currentToken, 0)} />
          <DisplayMetric label={t("avgMin")} value={queue.avgConsultMinutes} />
        </div>
      </div>

      <aside className="rounded-lg border border-white/70 bg-white p-6 shadow-panel">
        <h2 className="text-3xl font-black text-ink">{t("upcoming")}</h2>
        <div className="token-grid mt-6 grid gap-3">
          {upcoming.length === 0 ? (
            <p className="rounded-lg bg-cloud p-4 text-base font-bold text-slate-500">{t("noWaitingTokens")}</p>
          ) : (
            upcoming.map((token) => (
              <div key={token.tokenNumber} className="rounded-lg bg-cloud p-4 text-center">
                <p className="text-3xl font-black text-ink">#{token.tokenNumber}</p>
              </div>
            ))
          )}
        </div>
      </aside>
    </section>
  );
}

function DisplayMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/10 p-4">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
    </div>
  );
}
