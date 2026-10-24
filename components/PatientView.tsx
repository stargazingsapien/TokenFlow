"use client";

import { estimateDynamicWait, TokenRecord } from "@/lib/queue";
import { firebaseApp, firebaseVapidKey, isQueueSyncConfigured, publicQueueSignalRef } from "@/lib/firebase";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { onSnapshot } from "firebase/firestore";
import { useI18n } from "./I18nProvider";
import { useQueue } from "./QueueProvider";
import { StatusPill } from "./StatusPill";
import { useEffect, useMemo, useRef, useState } from "react";

type PatientTrackerData = {
  clinicName: string;
  doctorName: string;
  updatedAt: string;
  waitingCount: number;
  completedCount: number;
  currentTokenNumber: number;
  token: TokenRecord;
  waitMinutes: number;
  patientsAhead: number;
  isOvertime: boolean;
};

export function PatientView({ initialToken }: { initialToken: number }) {
  const { queue, stats, isReady } = useQueue();
  const { t, language } = useI18n();
  const [tokenNumber, setTokenNumber] = useState<number | "">(initialToken || "");
  const [accessKey, setAccessKey] = useState("");
  const [trackerData, setTrackerData] = useState<PatientTrackerData | null>(null);
  const [trackerStatus, setTrackerStatus] = useState<"local" | "connecting" | "live" | "offline" | "private-link">(
    isQueueSyncConfigured ? "connecting" : "local"
  );
  const [pushStatus, setPushStatus] = useState<"idle" | "enabling" | "enabled" | "error">("idle");
  const [pushMessage, setPushMessage] = useState("");
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const foregroundPushCleanupRef = useRef<(() => void) | null>(null);
  const selectedTokenNumber = tokenNumber === "" ? 0 : tokenNumber;

  useEffect(() => {
    setAccessKey(decodeURIComponent(window.location.hash.slice(1)));
  }, []);

  useEffect(() => {
    if (!isQueueSyncConfigured) {
      setTrackerStatus("local");
      return;
    }
    if (!selectedTokenNumber || !accessKey) {
      setTrackerData(null);
      setTrackerStatus("private-link");
      return;
    }

    let active = true;
    const refreshTracker = async () => {
      if (active) setTrackerStatus("connecting");
      try {
        const response = await fetch("/api/queue/public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ tokenNumber: selectedTokenNumber, accessKey })
        });
        if (!response.ok) {
          if (active) {
            setTrackerData(null);
            setTrackerStatus(response.status === 404 ? "private-link" : "offline");
          }
          return;
        }
        const next = (await response.json()) as PatientTrackerData;
        if (active) {
          setTrackerData(next);
          setTrackerStatus("live");
        }
      } catch {
        if (active) {
          setTrackerData(null);
          setTrackerStatus("offline");
        }
      }
    };

    void refreshTracker();
    const unsubscribeRealtime = publicQueueSignalRef
      ? onSnapshot(
          publicQueueSignalRef,
          () => void refreshTracker(),
          () => {
            if (active) setTrackerStatus("offline");
          }
        )
      : null;

    return () => {
      active = false;
      unsubscribeRealtime?.();
    };
  }, [accessKey, selectedTokenNumber]);

  // Find the patient's specific token record
  const tokenRecord = useMemo(
    () => isQueueSyncConfigured
      ? trackerData?.token
      : queue.tokens.find((item) => item.tokenNumber === selectedTokenNumber),
    [queue.tokens, selectedTokenNumber, trackerData]
  );

  const status = tokenRecord?.status ?? "WAITING";
  const patientName = tokenRecord?.patientName ?? "";

  // Dynamic wait time calculation for this patient
  const localDynamicWait = useMemo(
    () => estimateDynamicWait(queue, selectedTokenNumber),
    [queue, selectedTokenNumber]
  );
  const dynamicWait = isQueueSyncConfigured
    ? trackerData ?? { waitMinutes: 0, patientsAhead: 0, isOvertime: false }
    : localDynamicWait;
  const servingTokenNumber = isQueueSyncConfigured
    ? trackerData?.currentTokenNumber ?? 0
    : stats.servingToken?.tokenNumber ?? 0;
  const isCurrentlyServingMe = Boolean(selectedTokenNumber && servingTokenNumber === selectedTokenNumber);
  const waitingCount = isQueueSyncConfigured ? trackerData?.waitingCount ?? 0 : stats.waitingCount;
  const completedCount = isQueueSyncConfigured ? trackerData?.completedCount ?? 0 : stats.completedCount;
  const clinicName = trackerData?.clinicName ?? queue.clinicName;
  const doctorName = trackerData?.doctorName ?? queue.doctorName;

  useEffect(() => {
    if (!trackerData || !accessKey || !tokenRecord || typeof Notification === "undefined") return;

    // Show the opt-in dialog even if browser permission was granted earlier:
    // this device may still need to register its FCM token with the clinic.
    const dismissedKey = `tokenflow-push-prompt-dismissed-v2-${selectedTokenNumber}`;
    if (window.sessionStorage.getItem(dismissedKey) !== "1") {
      setShowNotificationPrompt(true);
    }
  }, [accessKey, selectedTokenNumber, tokenRecord, trackerData]);

  const dismissNotificationPrompt = () => {
    window.sessionStorage.setItem(`tokenflow-push-prompt-dismissed-v2-${selectedTokenNumber}`, "1");
    setShowNotificationPrompt(false);
  };

  const enablePhoneNotifications = async () => {
    if (!firebaseApp || !firebaseVapidKey || !accessKey || !selectedTokenNumber) {
      setPushStatus("error");
      setPushMessage(t("pushNotConfigured"));
      return;
    }

    setPushStatus("enabling");
    setPushMessage("");
    try {
      if (!(await isSupported())) {
        throw new Error("push-not-supported");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("error");
        setPushMessage(t("pushPermissionDenied"));
        return;
      }

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      const messaging = getMessaging(firebaseApp);
      const fcmToken = await getToken(messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: registration
      });
      if (!fcmToken) throw new Error("push-token-unavailable");

      const response = await fetch("/api/patient/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenNumber: selectedTokenNumber,
          accessKey,
          fcmToken,
          language
        })
      });
      if (!response.ok) throw new Error("push-registration-failed");

      foregroundPushCleanupRef.current?.();
      foregroundPushCleanupRef.current = onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? "TokenFlow";
        const body = payload.notification?.body ?? "Your clinic queue has an update.";
        const url = payload.data?.url ?? window.location.href;
        void registration.showNotification(title, { body, icon: "/favicon.ico", data: { url } });
      });
      setPushStatus("enabled");
      setPushMessage(t("pushEnabledMessage"));
      dismissNotificationPrompt();
    } catch {
      setPushStatus("error");
      setPushMessage(t("pushEnableFailed"));
    }
  };

  useEffect(() => () => foregroundPushCleanupRef.current?.(), []);

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
    if (isQueueSyncConfigured && trackerStatus === "private-link") {
      return t("patientPrivateLink");
    }
    if (isQueueSyncConfigured && trackerStatus === "offline") {
      return t("syncOffline");
    }
    if (isQueueSyncConfigured && trackerStatus === "connecting") {
      return t("syncing");
    }
    if (!selectedTokenNumber) {
      return t("patientEnterToken");
    }
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
  }, [isCurrentlyServingMe, selectedTokenNumber, status, t, tokenRecord, trackerStatus]);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      {showNotificationPrompt && trackerData && tokenRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-notification-title"
            className="relative w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl sm:p-8"
          >
            <button
              type="button"
              onClick={dismissNotificationPrompt}
              aria-label="Close notification prompt"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              ×
            </button>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl" aria-hidden="true">
              🔔
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">Token #{selectedTokenNumber}</p>
            <h2 id="patient-notification-title" className="mt-2 pr-8 text-2xl font-black tracking-tight text-slate-950">
              {t("phoneNotifications")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{t("phoneNotificationsDescription")}</p>
            <button
              type="button"
              onClick={() => void enablePhoneNotifications()}
              disabled={pushStatus === "enabling"}
              className="mt-6 w-full rounded-xl bg-indigo-700 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-700/20 transition hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60"
            >
              {pushStatus === "enabling" ? t("enablingPhoneNotifications") : t("enablePhoneNotifications")}
            </button>
            <button
              type="button"
              onClick={dismissNotificationPrompt}
              className="mt-3 w-full rounded-xl px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              {t("notNow")}
            </button>
            {pushMessage && <p role="status" className="mt-3 text-center text-xs font-semibold text-indigo-950">{pushMessage}</p>}
          </div>
        </div>
      )}
      {/* Read-Only Notice Badge */}
      <div className="flex items-center justify-between rounded-xl border border-blue-200/60 bg-blue-50/80 px-4 py-2.5 text-xs font-semibold text-blue-800">
        <span className="flex items-center gap-1.5">
          <span>{t("patientReadOnlyNotice")}</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          {trackerStatus === "live"
            ? t("liveSynced")
            : trackerStatus === "connecting"
              ? t("syncing")
              : trackerStatus === "offline"
                ? t("syncOffline")
                : trackerStatus === "private-link"
                  ? t("patientPrivateLinkShort")
                  : t("deviceOnly")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        {/* Left Column: Token Selector & Clinic Info */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-widest text-mint">
              {t("patientTracker")}
            </span>
            <h1 className="mt-2 text-3xl font-black text-ink">{clinicName}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {t("doctor")}: <span className="font-bold text-ink">{doctorName}</span>
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
                  disabled={isQueueSyncConfigured}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTokenNumber(value ? Math.max(1, Number(value)) : "");
                  }}
                  placeholder="—"
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
              <p className="mt-1 text-xl font-black text-ink">{patientName || (isQueueSyncConfigured ? t("patientPrivateLinkShort") : t("patientEnterToken"))}</p>
              <div className="mt-2">
                {tokenRecord ? (
                  <StatusPill status={status} />
                ) : isQueueSyncConfigured ? (
                  <p className="text-sm font-medium text-slate-500">{t("patientPrivateLink")}</p>
                ) : !selectedTokenNumber ? (
                  <p className="text-sm font-medium text-slate-500">{t("patientEnterToken")}</p>
                ) : (
                  <p className="text-sm font-semibold text-rose-700">{t("tokenNotFound")}</p>
                )}
              </div>
            </div>
          </div>

          {isQueueSyncConfigured && trackerData && accessKey && tokenRecord && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 shadow-sm">
              <h3 className="text-sm font-black text-indigo-950">{t("phoneNotifications")}</h3>
              <p className="mt-1 text-sm text-indigo-900/80">{t("phoneNotificationsDescription")}</p>
              <button
                type="button"
                onClick={() => void enablePhoneNotifications()}
                disabled={pushStatus === "enabling"}
                className="mt-3 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60"
              >
                {pushStatus === "enabling"
                  ? t("enablingPhoneNotifications")
                  : pushStatus === "enabled"
                    ? t("phoneNotificationsEnabled")
                    : t("enablePhoneNotifications")}
              </button>
              {pushMessage && <p role="status" className="mt-2 text-xs font-semibold text-indigo-950">{pushMessage}</p>}
            </div>
          )}

          {/* OPD Queue Status Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("liveOpdQueue")} Summary
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">{t("waiting")}</p>
                <p className="text-2xl font-black text-ink">{waitingCount}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">{t("completedCheckups")}</p>
                <p className="text-2xl font-black text-emerald-700">{completedCount}</p>
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
                    Token #{selectedTokenNumber} · {patientName}
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
                #{servingTokenNumber || "--"}
              </p>
              <p className="mt-3 truncate text-sm font-semibold text-slate-300">
                {servingTokenNumber
                  ? isCurrentlyServingMe
                    ? patientName
                    : isQueueSyncConfigured
                      ? t("inConsultation")
                      : stats.servingToken?.patientName
                  : t("roomReady")}
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
              <p className="mt-2 text-6xl font-black leading-none">#{selectedTokenNumber || "—"}</p>
              <p className="mt-3 truncate text-sm font-bold opacity-80">{patientName || t("patientEnterToken")}</p>
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
              {!selectedTokenNumber ? (
                <span className="font-semibold text-slate-500">{t("patientEnterToken")}</span>
              ) : isQueueSyncConfigured && !tokenRecord ? (
                <span className="font-semibold text-slate-500">{t("patientPrivateLink")}</span>
              ) : !tokenRecord ? (
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
                  ? new Date(trackerData?.updatedAt ?? queue.updatedAt).toLocaleTimeString([], {
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
