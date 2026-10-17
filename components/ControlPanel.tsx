"use client";

import { TokenRecord, estimateDynamicWait } from "@/lib/queue";
import { useI18n } from "./I18nProvider";
import { useQueue } from "./QueueProvider";
import { StatusPill } from "./StatusPill";
import { WhatsAppSendPanel } from "./WhatsAppSendPanel";
import { useEffect, useMemo, useState } from "react";

const clickerKeys = new Set([" ", "Enter", "ArrowRight", "n", "N"]);

export function ControlPanel() {
  const {
    queue,
    stats,
    issue,
    next,
    callSpecific,
    completeCheckup,
    skip,
    requeue,
    cancel,
    reset,
    saveSettings,
    audioEnabled,
    setAudioEnabled,
    notificationsEnabled,
    enableNotifications
  } = useQueue();

  const { t } = useI18n();

  // Mode: "doctor" | "receptionist" | "dual"
  const [activeRole, setActiveRole] = useState<"doctor" | "receptionist" | "dual">("doctor");

  // New token form state
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [lastIssuedMessage, setLastIssuedMessage] = useState<string | null>(null);

  // Settings form state
  const [clinicName, setClinicName] = useState(queue.clinicName);
  const [doctorName, setDoctorName] = useState(queue.doctorName);
  const [avgConsultMinutes, setAvgConsultMinutes] = useState(queue.avgConsultMinutes);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Queue filter and search
  const [queueTab, setQueueTab] = useState<"waiting" | "all" | "completed" | "skipped">("waiting");
  const [searchQuery, setSearchQuery] = useState("");

  // Token cancel confirmation modal state
  const [tokenToCancel, setTokenToCancel] = useState<TokenRecord | null>(null);

  // Live consultation stopwatch
  const [timerSeconds, setTimerSeconds] = useState(0);

  const servingToken = stats.servingToken;

  useEffect(() => {
    setClinicName(queue.clinicName);
    setDoctorName(queue.doctorName);
    setAvgConsultMinutes(queue.avgConsultMinutes);
  }, [queue.avgConsultMinutes, queue.clinicName, queue.doctorName]);

  // Stopwatch for currently serving patient
  useEffect(() => {
    if (!servingToken?.servedAt) {
      setTimerSeconds(0);
      return;
    }

    const calculateSeconds = () => {
      const startMs = new Date(servingToken.servedAt!).getTime();
      const diffSecs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setTimerSeconds(diffSecs);
    };

    calculateSeconds();
    const interval = setInterval(calculateSeconds, 1000);
    return () => clearInterval(interval);
  }, [servingToken?.servedAt]);

  // Keyboard shortcut for fast desk-clicker
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (!clickerKeys.has(event.key)) return;
      event.preventDefault();
      if (stats.waitingCount > 0) {
        next();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, stats.waitingCount]);

  const handleIssueToken = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newPatientName.trim();
    issue(name, newPatientPhone);
    const assignedName = name || `Patient #${queue.totalIssued + 1}`;
    setLastIssuedMessage(`#${queue.totalIssued + 1} · ${assignedName}`);
    setNewPatientName("");
    setNewPatientPhone("");
    setTimeout(() => setLastIssuedMessage(null), 4500);
  };

  const handleQuickIssue = () => {
    issue();
    setLastIssuedMessage(`#${queue.totalIssued + 1} · Patient #${queue.totalIssued + 1}`);
    setTimeout(() => setLastIssuedMessage(null), 4000);
  };

  const handleConfirmCancel = () => {
    if (tokenToCancel) {
      cancel(tokenToCancel.tokenNumber);
      setTokenToCancel(null);
    }
  };

  // Filtered queue items
  const filteredTokens = useMemo(() => {
    let list = queue.tokens;

    if (queueTab === "waiting") {
      list = list.filter((t) => t.status === "WAITING");
    } else if (queueTab === "completed") {
      list = list.filter((t) => t.status === "COMPLETED");
    } else if (queueTab === "skipped") {
      list = list.filter((t) => t.status === "SKIPPED");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.tokenNumber.toString().includes(q) ||
          t.patientName.toLowerCase().includes(q) ||
          (t.patientPhone && t.patientPhone.includes(q))
      );
    }

    return [...list].reverse();
  }, [queue.tokens, queueTab, searchQuery]);

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [timerSeconds]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Header & Role Switcher */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/80 bg-white/90 p-4 shadow-panel backdrop-blur sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500"></span>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
              {t("liveOpdQueue")}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-ink sm:text-3xl">{queue.clinicName}</h1>
          <p className="text-sm font-semibold text-slate-500">
            {t("doctor")}: <span className="text-ink font-bold">{queue.doctorName}</span>
          </p>
        </div>

        {/* Role Mode Selector & Sound Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setActiveRole("doctor")}
              className={`rounded-md px-3.5 py-1.5 text-xs font-black transition ${
                activeRole === "doctor"
                  ? "bg-white text-ink shadow-sm"
                  : "text-slate-600 hover:text-ink"
              }`}
            >
              {t("doctorConsole")}
            </button>
            <button
              onClick={() => setActiveRole("receptionist")}
              className={`rounded-md px-3.5 py-1.5 text-xs font-black transition ${
                activeRole === "receptionist"
                  ? "bg-white text-ink shadow-sm"
                  : "text-slate-600 hover:text-ink"
              }`}
            >
              {t("receptionistDesk")}
            </button>
            <button
              onClick={() => setActiveRole("dual")}
              className={`hidden rounded-md px-3.5 py-1.5 text-xs font-black transition sm:block ${
                activeRole === "dual"
                  ? "bg-white text-ink shadow-sm"
                  : "text-slate-600 hover:text-ink"
              }`}
            >
              ⚡ Dual View
            </button>
          </div>

          {/* Audio Chime Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? t("soundEnabled") : t("soundDisabled")}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              audioEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-500 line-through"
            }`}
          >
            <span>{audioEnabled ? "🔔" : "🔕"}</span>
            <span className="hidden sm:inline">{audioEnabled ? t("soundAlerts") : "Muted"}</span>
          </button>

          {/* Desktop Push Notification Toggle */}
          {!notificationsEnabled && (
            <button
              onClick={enableNotifications}
              className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 transition hover:bg-sky-100"
            >
              <span>📩</span>
              <span className="hidden sm:inline">{t("enableNotifications")}</span>
            </button>
          )}
        </div>
      </header>

      {/* OPD Live Overview Metric Cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            {t("nowServing")}
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-700">
              {servingToken ? `#${servingToken.tokenNumber}` : "--"}
            </span>
            {servingToken && (
              <span className="truncate text-xs font-bold text-slate-600">
                {servingToken.patientName}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {servingToken ? t("statusServing") : t("roomReady")}
          </p>
        </div>

        <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
            {t("waiting")} (Ketla baki che)
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-600">{stats.waitingCount}</span>
            <span className="text-xs font-bold text-slate-500">
              ~{stats.waitingCount * stats.effectiveAvgMinutes} {t("min")}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {stats.waitingCount === 1 ? t("patientSingular") : t("patientPlural")} in line
          </p>
        </div>

        <div className="rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
            {t("completedCheckups")} (Ketla thay gaya)
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-teal-700">{stats.completedCount}</span>
            <span className="text-xs font-bold text-teal-600">✅ Done</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Checked today</p>
        </div>

        <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-orange-800">
            {t("absentSkipped")}
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-orange-600">{stats.skippedCount}</span>
            <span className="text-xs font-bold text-slate-400">Can Recall</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Missed turn</p>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-800">
              {t("dynamicWait")}
            </p>
            <span className="text-xs font-bold text-amber-500">⚡</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-indigo-700">
              {stats.effectiveAvgMinutes} <span className="text-sm font-semibold">{t("min")}</span>
            </span>
            {stats.actualAvgMinutes && (
              <span className="text-xs font-semibold text-slate-500">
                Pace: {stats.actualAvgMinutes}m
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate" title={t("dynamicWaitTooltip")}>
            {stats.isOvertime ? `Overtime +${stats.overtimeMinutes}m active` : "Auto-adjusts live"}
          </p>
        </div>
      </section>

      <WhatsAppSendPanel />

      {/* Main Workspace (Doctor Console, Reception Desk, or Dual) */}
      <div
        className={`grid gap-6 ${
          activeRole === "dual" ? "lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {/* DOCTOR CONSOLE SECTION */}
        {(activeRole === "doctor" || activeRole === "dual") && (
          <section className="space-y-5">
            {/* Active Consultation Hero Card */}
            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-emerald-100 p-2 text-xl text-emerald-700">🩺</span>
                  <div>
                    <h2 className="text-lg font-black text-ink">{t("doctorConsole")}</h2>
                    <p className="text-xs font-semibold text-slate-500">{t("inConsultation")}</p>
                  </div>
                </div>

                {/* Consultation Timer / Stopwatch */}
                {servingToken ? (
                  <div
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-sm font-black transition ${
                      stats.isOvertime
                        ? "bg-rose-100 text-rose-700 animate-pulse border border-rose-300"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span>⏱ {formattedTimer}</span>
                    {stats.isOvertime && (
                      <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] text-white">
                        +{stats.overtimeMinutes}m
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="rounded-xl bg-emerald-50 px-3.5 py-1.5 text-xs font-black text-emerald-700 border border-emerald-200">
                    🟢 {t("roomReady")}
                  </span>
                )}
              </div>

              {/* Patient In Room Details */}
              <div className="my-6">
                {servingToken ? (
                  <div className="rounded-2xl bg-gradient-to-br from-slatepanel to-ink p-6 text-white shadow-md">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-amberline">
                          {t("nowServing")}
                        </span>
                        <div className="mt-1 flex items-baseline gap-3">
                          <span className="text-6xl font-black">#{servingToken.tokenNumber}</span>
                          <span className="text-2xl font-bold text-white/90">
                            {servingToken.patientName}
                          </span>
                        </div>
                        {servingToken.patientPhone && (
                          <p className="mt-1 text-sm text-slate-300 font-mono">
                            📞 {servingToken.patientPhone}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl bg-white/10 px-3 py-2 text-right">
                        <p className="text-xs text-slate-300">Target Time</p>
                        <p className="text-lg font-bold text-amberline">
                          {stats.effectiveAvgMinutes} mins
                        </p>
                      </div>
                    </div>

                    {stats.isOvertime && (
                      <div className="mt-4 rounded-lg bg-rose-500/20 border border-rose-400/40 p-2.5 text-xs font-semibold text-rose-200">
                        ⚠️ {t("overtimeWarning")} (+{stats.overtimeMinutes} mins). Subsequent
                        patients&apos; wait time has been dynamically updated!
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                    <p className="text-4xl">🚪</p>
                    <h3 className="mt-2 text-lg font-black text-ink">{t("readyForNext")}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {stats.waitingCount > 0
                        ? `Next in line: #${stats.waitingTokens[0]?.tokenNumber} · ${stats.waitingTokens[0]?.patientName}`
                        : t("noWaitingTokens")}
                    </p>
                  </div>
                )}
              </div>

              {/* DOCTOR ACTION BUTTONS */}
              <div className="grid gap-3 sm:grid-cols-3">
                {/* 1. Patient Checkup Completed Button */}
                <button
                  onClick={completeCheckup}
                  disabled={!servingToken}
                  className="flex flex-col items-center justify-center rounded-xl bg-emerald-600 px-4 py-4 text-center font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <span className="text-lg">✅ {t("checkupCompleted")}</span>
                  <span className="text-[11px] font-semibold opacity-90">
                    Finish & clear room
                  </span>
                </button>

                {/* 2. Call Next Patient Button */}
                <button
                  onClick={next}
                  disabled={stats.waitingCount === 0}
                  className="flex flex-col items-center justify-center rounded-xl bg-ink px-4 py-4 text-center font-black text-white shadow-sm transition hover:bg-slatepanel active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <span className="text-lg">🔔 {t("callNextPatient")}</span>
                  <span className="text-[11px] font-semibold opacity-90">
                    {stats.waitingCount > 0
                      ? `Call #${stats.waitingTokens[0]?.tokenNumber} · ${stats.waitingTokens[0]?.patientName}`
                      : "No waiting patients"}
                  </span>
                </button>

                {/* 3. Skip Button (Absent Patient) */}
                <button
                  onClick={() => skip()}
                  disabled={!servingToken}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-orange-200 bg-orange-50 px-4 py-4 text-center font-black text-orange-700 transition hover:bg-orange-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <span className="text-lg">⏭️ {t("skipAbsent")}</span>
                  <span className="text-[11px] font-semibold opacity-80">
                    Patient not at door
                  </span>
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>⌨️ {t("clickerKeys")}</span>
                <span className="font-semibold text-emerald-700">
                  ⚡ Auto-sync with Reception Desk
                </span>
              </div>
            </div>

            {/* Upcoming Patients Outside Door */}
            <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-panel">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-ink">
                  👥 {t("upcoming")} ({stats.waitingCount})
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {t("dynamicWaitBadge")}
                </span>
              </div>

              <div className="mt-3 divide-y divide-slate-100">
                {stats.waitingTokens.length === 0 ? (
                  <p className="py-6 text-center text-sm font-semibold text-slate-400">
                    {t("noWaitingTokens")}
                  </p>
                ) : (
                  stats.waitingTokens.slice(0, 6).map((token, index) => {
                    const est = estimateDynamicWait(queue, token.tokenNumber);
                    return (
                      <div
                        key={token.tokenNumber}
                        className="flex items-center justify-between py-3 transition hover:bg-slate-50/80 px-2 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-black text-ink">
                              #{token.tokenNumber} · {token.patientName}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              Estimated wait: ~{est.waitMinutes} mins
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => callSpecific(token.tokenNumber)}
                            className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Call Now 🔔
                          </button>
                          <button
                            onClick={() => skip(token.tokenNumber)}
                            title="Mark Absent"
                            className="rounded-lg border border-slate-200 p-1.5 text-xs text-slate-500 hover:bg-orange-50 hover:text-orange-700"
                          >
                            ⏭️
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {/* RECEPTIONIST DESK SECTION */}
        {(activeRole === "receptionist" || activeRole === "dual") && (
          <section className="space-y-5">
            {/* Issue Token Form */}
            <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-panel">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-indigo-100 p-2 text-xl text-indigo-700">📋</span>
                  <div>
                    <h2 className="text-lg font-black text-ink">{t("issueNewToken")}</h2>
                    <p className="text-xs font-semibold text-slate-500">
                      Token #{queue.totalIssued + 1} ready to issue
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleQuickIssue}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-ink transition hover:bg-slate-100"
                >
                  ⚡ {t("quickIssue")}
                </button>
              </div>

              {lastIssuedMessage && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-black text-emerald-800 animate-fadeIn">
                  🎉 {t("tokenIssuedSuccess")}: {lastIssuedMessage}
                </div>
              )}

              <form onSubmit={handleIssueToken} className="mt-4 grid gap-3.5">
                <label className="grid gap-1 text-xs font-bold text-slate-600">
                  {t("patientName")} *
                  <input
                    type="text"
                    required
                    placeholder={t("enterPatientName")}
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-ink transition focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20"
                  />
                </label>

                <label className="grid gap-1 text-xs font-bold text-slate-600">
                  {t("patientPhone")}
                  <input
                    type="tel"
                    placeholder={t("enterPhone")}
                    value={newPatientPhone}
                    onChange={(e) => setNewPatientPhone(e.target.value)}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-ink transition focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr]">
                  <button
                    type="submit"
                    className="rounded-xl bg-ink px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-slatepanel active:scale-[0.98]"
                  >
                    + {t("issueToken")} #{queue.totalIssued + 1}
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    disabled={stats.waitingCount === 0}
                    className="rounded-xl bg-mint px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    🔔 {t("callNextPatient")}
                  </button>
                </div>
              </form>
            </div>

            {/* Live OPD Queue Manager & Action List */}
            <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-ink">{t("liveOpdQueue")}</h3>

                {/* Queue Filter Tabs */}
                <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold">
                  <button
                    onClick={() => setQueueTab("waiting")}
                    className={`rounded-md px-2.5 py-1 transition ${
                      queueTab === "waiting" ? "bg-white text-ink shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {t("activeQueue")} ({stats.waitingCount})
                  </button>
                  <button
                    onClick={() => setQueueTab("completed")}
                    className={`rounded-md px-2.5 py-1 transition ${
                      queueTab === "completed" ? "bg-white text-ink shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Done ({stats.completedCount})
                  </button>
                  <button
                    onClick={() => setQueueTab("skipped")}
                    className={`rounded-md px-2.5 py-1 transition ${
                      queueTab === "skipped" ? "bg-white text-ink shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Absent ({stats.skippedCount})
                  </button>
                  <button
                    onClick={() => setQueueTab("all")}
                    className={`rounded-md px-2.5 py-1 transition ${
                      queueTab === "all" ? "bg-white text-ink shadow-sm" : "text-slate-500"
                    }`}
                  >
                    All ({queue.tokens.length})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mt-3">
                <input
                  type="text"
                  placeholder={t("searchPatient")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-ink placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-mint"
                />
              </div>

              {/* Queue Table */}
              <div className="mt-3 max-h-[420px] overflow-y-auto divide-y divide-slate-100">
                {filteredTokens.length === 0 ? (
                  <p className="py-8 text-center text-xs font-semibold text-slate-400">
                    {t("noPatientsInQueue")}
                  </p>
                ) : (
                  filteredTokens.map((token) => {
                    const est = estimateDynamicWait(queue, token.tokenNumber);
                    return (
                      <div
                        key={token.tokenNumber}
                        className="flex flex-wrap items-center justify-between gap-2 py-3 px-2 transition hover:bg-slate-50/80 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-black text-ink text-base">
                            #{token.tokenNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-ink text-sm">
                                {token.patientName}
                              </span>
                              <StatusPill status={token.status} />
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              {token.patientPhone && <span>📞 {token.patientPhone}</span>}
                              {token.status === "WAITING" && (
                                <span className="font-semibold text-amber-600">
                                  ~{est.waitMinutes}m wait ({est.patientsAhead} ahead)
                                </span>
                              )}
                              {token.status === "COMPLETED" && token.actualDurationMinutes && (
                                <span className="text-teal-700">
                                  Duration: {token.actualDurationMinutes} mins
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Row Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          {token.status === "WAITING" && (
                            <>
                              <button
                                onClick={() => callSpecific(token.tokenNumber)}
                                className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                              >
                                Call 🔔
                              </button>
                              <button
                                onClick={() => skip(token.tokenNumber)}
                                className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700 hover:bg-orange-100"
                              >
                                Skip ⏭️
                              </button>
                              {/* Mistake Cancel Button */}
                              <button
                                onClick={() => setTokenToCancel(token)}
                                title="Cancel Token (Mistake)"
                                className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                              >
                                ✕ Cancel
                              </button>
                            </>
                          )}

                          {token.status === "SKIPPED" && (
                            <button
                              onClick={() => requeue(token.tokenNumber)}
                              className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-black text-amber-800 hover:bg-amber-100"
                            >
                              ↩ {t("requeue")}
                            </button>
                          )}

                          {token.status === "SERVING" && (
                            <button
                              onClick={completeCheckup}
                              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-black text-white hover:bg-emerald-700"
                            >
                              ✅ Complete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Clinic Setup & Reset Accordion */}
            <details className="group rounded-2xl border border-white/80 bg-white p-5 shadow-panel">
              <summary className="flex cursor-pointer items-center justify-between font-black text-ink text-sm">
                <span>⚙️ {t("clinicSetup")}</span>
                <span className="text-xs text-slate-400 group-open:rotate-180 transition">▼</span>
              </summary>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveSettings({ clinicName, doctorName, avgConsultMinutes });
                  setSettingsSaved(true);
                  setTimeout(() => setSettingsSaved(false), 3000);
                }}
                className="mt-4 grid gap-3 pt-3 border-t border-slate-100"
              >
                {settingsSaved && (
                  <p className="rounded-lg bg-emerald-50 p-2 text-xs font-bold text-emerald-700">
                    ✓ Setup saved successfully!
                  </p>
                )}
                <label className="grid gap-1 text-xs font-bold text-slate-600">
                  {t("clinicName")}
                  <input
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink"
                  />
                </label>

                <label className="grid gap-1 text-xs font-bold text-slate-600">
                  {t("doctorName")}
                  <input
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink"
                  />
                </label>

                <label className="grid gap-1 text-xs font-bold text-slate-600">
                  {t("averageConsultationMinutes")}
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={avgConsultMinutes}
                    onChange={(e) => setAvgConsultMinutes(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-amberline px-4 py-2 text-xs font-black text-ink hover:brightness-95"
                  >
                    {t("saveSetup")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to reset all tokens for today? This clears the queue."
                        )
                      ) {
                        reset();
                      }
                    }}
                    className="rounded-lg border border-coral px-3 py-1.5 text-xs font-black text-coral hover:bg-coral hover:text-white"
                  >
                    {t("resetDay")}
                  </button>
                </div>
              </form>
            </details>
          </section>
        )}
      </div>

      {/* Confirmation Modal for Mistaken Token Cancel */}
      {tokenToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slatepanel/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold">
                ✕
              </span>
              <div>
                <h3 className="text-lg font-black text-ink">{t("cancelToken")}</h3>
                <p className="text-xs text-slate-500">{t("mistakeToken")}</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              {t("cancelConfirm")
                .replace("{num}", tokenToCancel.tokenNumber.toString())
                .replace("{name}", tokenToCancel.patientName)}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTokenToCancel(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                No, Keep Token
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-black text-white hover:bg-rose-700"
              >
                Yes, Cancel Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
