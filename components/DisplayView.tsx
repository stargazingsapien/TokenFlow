"use client";

import { estimateDynamicWait } from "@/lib/queue";
import { playHospitalChime, speakCallAnnouncement } from "@/lib/alerts";
import { LanguageSwitcher } from "./I18nProvider";
import { useI18n } from "./I18nProvider";
import { useQueue } from "./QueueProvider";
import { useEffect, useMemo, useRef, useState } from "react";

export function DisplayView() {
  const { queue, stats, audioEnabled, setAudioEnabled } = useQueue();
  const { t, language } = useI18n();

  const [callBanner, setCallBanner] = useState<{
    tokenNumber: number;
    patientName: string;
  } | null>(null);

  const lastCalledTokenRef = useRef(queue.lastCalledToken);

  const servingToken = stats.servingToken;

  // Next upcoming waiting tokens in queue
  const upcomingTokens = useMemo(
    () => stats.waitingTokens.slice(0, 10),
    [stats.waitingTokens]
  );

  // Play sound & show banner when a patient is called
  useEffect(() => {
    if (!queue.lastCalledToken || queue.lastCalledToken === lastCalledTokenRef.current) {
      return;
    }

    lastCalledTokenRef.current = queue.lastCalledToken;
    const patientName = queue.lastCalledName || `Patient #${queue.lastCalledToken}`;

    // Show visual announcement banner for 9 seconds
    setCallBanner({ tokenNumber: queue.lastCalledToken, patientName });
    const timer = setTimeout(() => {
      setCallBanner(null);
    }, 9000);

    return () => clearTimeout(timer);
  }, [queue.lastCalledToken, queue.lastCalledName]);

  return (
    <section className="mx-auto grid min-h-[calc(100vh-1.5rem)] min-w-0 max-w-[1600px] gap-3 sm:gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      {/* Call Announcement Banner Overlay */}
      {callBanner && (
        <div role="status" className="fixed inset-x-4 top-20 z-50 mx-auto max-w-3xl animate-fadeIn rounded-2xl border border-amber-300 bg-slate-900 p-6 text-white shadow-2xl sm:inset-x-auto sm:w-full">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-amberline">
                  {t("nowCalling")}
                </p>
                <h2 className="mt-1 break-words text-2xl font-black sm:text-5xl">
                  #{callBanner.tokenNumber} · {callBanner.patientName}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {t("proceedMessage")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setCallBanner(null)}
              className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30 text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Waiting Room Display Column */}
      <div className="flex min-w-0 flex-col justify-between rounded-3xl bg-slate-900 p-4 text-white shadow-xl sm:p-8 lg:p-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-base font-bold uppercase tracking-[0.25em] text-amberline">
              {queue.clinicName}
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">{t("nowServing")}</h1>
          </div>

          {/* Audio Mute/Unmute Control for Display Screen */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg bg-white px-2 py-1 text-ink">
              <LanguageSwitcher />
            </div>
            <button
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (!audioEnabled) {
                  playHospitalChime();
                }
              }}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <span>{audioEnabled ? "Sound on" : "Sound muted"}</span>
            </button>
            <button
              onClick={() => {
                playHospitalChime();
                speakCallAnnouncement(queue.currentToken || 1, t("audioTestPatient"), language);
              }}
              className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              {t("testAudio")}
            </button>
          </div>
        </div>

        {/* Hero Serving Token Number & Patient Name */}
        <div className="my-10 text-center">
          {servingToken ? (
            <div className="space-y-4">
              <p className="break-all text-[clamp(4.5rem,24vw,8rem)] font-black leading-none tracking-tight sm:text-[13rem]">
                #{servingToken.tokenNumber}
              </p>
              <div className="inline-block rounded-2xl bg-white/10 px-6 py-3 backdrop-blur-md">
                <p className="break-words text-xl font-black text-amberline sm:text-4xl">
                  {servingToken.patientName}
                </p>
              </div>
              <p className="text-lg font-semibold text-slate-300 sm:text-xl">
                {t("doctor")}: <span className="font-bold text-white">{queue.doctorName}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-10">
              <h2 className="text-4xl font-bold text-slate-100">{t("roomReady")}</h2>
              <p className="text-lg text-slate-400">{t("readyForNext")}</p>
            </div>
          )}
        </div>

        {/* Bottom OPD Status Metrics */}
        <div className="grid gap-3 sm:grid-cols-3">
          <DisplayMetric label={t("waiting")} value={stats.waitingCount} sub="in line" />
          <DisplayMetric label={t("completedCheckups")} value={stats.completedCount} sub="done today" />
          <DisplayMetric
            label={t("dynamicWait")}
            value={`~${stats.effectiveAvgMinutes}m`}
            sub="avg pace"
          />
        </div>
      </div>

      {/* Right Column: Upcoming Waiting Tokens List */}
      <aside className="flex min-w-0 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-black text-ink">{t("upcoming")}</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {stats.waitingCount} {t("waiting")}
            </span>
          </div>

          <div className="mt-4 space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            {upcomingTokens.length === 0 ? (
              <div className="rounded-2xl bg-cloud p-8 text-center">
                <p className="text-3xl">☕</p>
                <p className="mt-2 text-sm font-bold text-slate-500">{t("noWaitingTokens")}</p>
              </div>
            ) : (
              upcomingTokens.map((token, index) => {
                const est = estimateDynamicWait(queue, token.tokenNumber);
                return (
                  <div
                    key={token.tokenNumber}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-cloud/70 p-4 transition hover:border-mint/30 hover:bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-sm font-black text-white">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-lg font-black text-ink">
                          #{token.tokenNumber}
                        </p>
                        <p className="text-xs font-bold text-slate-600 truncate max-w-[150px]">
                          {token.patientName}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-black text-amber-800">
                        ~{est.waitMinutes} {t("min")}
                      </span>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {est.patientsAhead} ahead
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-3 text-center text-xs font-semibold text-slate-400">
          TokenFlow · Live waiting room
        </div>
      </aside>
    </section>
  );
}

function DisplayMetric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-300">{label}</p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
