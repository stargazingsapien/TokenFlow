"use client";

import {
  QueueDynamicStats,
  QueueState,
  calculateDynamicStats,
  callNextToken,
  callSpecificToken,
  cancelToken,
  completeCurrentCheckup,
  createQueueChannel,
  defaultQueueState,
  issueToken,
  loadQueue,
  requeueToken,
  resetQueue,
  saveQueue,
  skipCurrentToken,
  updateSettings
} from "@/lib/queue";
import {
  playHospitalChime,
  requestNotificationPermission,
  showSystemNotification,
  speakCallAnnouncement
} from "@/lib/alerts";
import { notifyPatientWhatsApp } from "@/lib/whatsappClient";
import { useI18n } from "./I18nProvider";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type QueueContextValue = {
  queue: QueueState;
  isReady: boolean;
  stats: QueueDynamicStats;
  issue: (patientName?: string, patientPhone?: string) => void;
  next: () => void;
  callSpecific: (tokenNumber: number) => void;
  completeCheckup: () => void;
  skip: (tokenNumber?: number) => void;
  requeue: (tokenNumber: number) => void;
  cancel: (tokenNumber: number) => void;
  reset: () => void;
  saveSettings: (settings: Pick<QueueState, "clinicName" | "doctorName" | "avgConsultMinutes">) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  notificationsEnabled: boolean;
  enableNotifications: () => Promise<boolean>;
  triggerCallAlert: (tokenNumber: number, patientName: string) => void;
};

const QueueContext = createContext<QueueContextValue | null>(null);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueState>(defaultQueueState);
  const [isReady, setIsReady] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const channelRef = useRef<ReturnType<typeof createQueueChannel> | null>(null);
  const lastProcessedCallRef = useRef<string | undefined>(undefined);
  const { language } = useI18n();

  // Periodic tick every 3 seconds to keep dynamic wait times and consultation stopwatch real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Check initial notification status
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const triggerCallAlert = useCallback(
    (tokenNumber: number, patientName: string) => {
      if (audioEnabled) {
        playHospitalChime();
        speakCallAnnouncement(tokenNumber, patientName, language);
      }
      showSystemNotification(tokenNumber, patientName, queue.clinicName);
    },
    [audioEnabled, language, queue.clinicName]
  );

  useEffect(() => {
    const initialQueue = loadQueue();
    setQueue(initialQueue);
    lastProcessedCallRef.current = initialQueue.lastCalledAt;
    setIsReady(true);

    channelRef.current = createQueueChannel((incoming) => {
      saveQueue(incoming);
      setQueue(incoming);

      // If incoming state indicates a patient was just called from another tab/screen:
      if (incoming.lastCalledAt && incoming.lastCalledAt !== lastProcessedCallRef.current) {
        lastProcessedCallRef.current = incoming.lastCalledAt;
        if (incoming.lastCalledToken && incoming.lastCalledName) {
          triggerCallAlert(incoming.lastCalledToken, incoming.lastCalledName);
        }
      }
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key === "tokenflow.queue.v1") {
        const fresh = loadQueue();
        setQueue(fresh);
        if (fresh.lastCalledAt && fresh.lastCalledAt !== lastProcessedCallRef.current) {
          lastProcessedCallRef.current = fresh.lastCalledAt;
          if (fresh.lastCalledToken && fresh.lastCalledName) {
            triggerCallAlert(fresh.lastCalledToken, fresh.lastCalledName);
          }
        }
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      channelRef.current?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [triggerCallAlert]);

  const notifyCalledPatientWhatsApp = useCallback((state: QueueState) => {
    if (!state.lastCalledToken) return;

    const called = state.tokens.find((token) => token.tokenNumber === state.lastCalledToken);
    if (!called) return;

    const phone = called.patientPhone?.trim();
    if (!phone) return;

    void notifyPatientWhatsApp({
      to: phone,
      tokenNumber: called.tokenNumber,
      patientName: called.patientName || state.lastCalledName || `Patient #${called.tokenNumber}`,
      clinicName: state.clinicName,
      doctorName: state.doctorName
    }).then((result) => {
      if (!result.ok) {
        console.warn("[TokenFlow WhatsApp]", result.message);
        return;
      }
      if (result.mode === "mock") {
        console.info("[TokenFlow WhatsApp] mock send for token", called.tokenNumber);
      }
    });
  }, []);

  const commit = useCallback(
    (updater: (state: QueueState) => QueueState, isCallAction = false) => {
      setQueue((current) => {
        const nextState = updater(current);
        saveQueue(nextState);
        channelRef.current?.post(nextState);

        if (isCallAction && nextState.lastCalledToken && nextState.lastCalledName) {
          lastProcessedCallRef.current = nextState.lastCalledAt;
          triggerCallAlert(nextState.lastCalledToken, nextState.lastCalledName);
          // Only the initiating control tab sends WhatsApp (not BroadcastChannel listeners).
          notifyCalledPatientWhatsApp(nextState);
        }

        return nextState;
      });
    },
    [notifyCalledPatientWhatsApp, triggerCallAlert]
  );

  const enableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    return granted;
  }, []);

  const stats = useMemo(
    () => calculateDynamicStats(queue, currentTimeMs),
    [queue, currentTimeMs]
  );

  const value = useMemo<QueueContextValue>(
    () => ({
      queue,
      isReady,
      stats,
      issue: (patientName, patientPhone) =>
        commit((state) => issueToken(state, patientName, patientPhone)),
      next: () => commit(callNextToken, true),
      callSpecific: (tokenNumber) =>
        commit((state) => callSpecificToken(state, tokenNumber), true),
      completeCheckup: () => commit(completeCurrentCheckup),
      skip: (tokenNumber) => commit((state) => skipCurrentToken(state, tokenNumber)),
      requeue: (tokenNumber) => commit((state) => requeueToken(state, tokenNumber)),
      cancel: (tokenNumber) => commit((state) => cancelToken(state, tokenNumber)),
      reset: () => commit(resetQueue),
      saveSettings: (settings) => commit((state) => updateSettings(state, settings)),
      audioEnabled,
      setAudioEnabled,
      notificationsEnabled,
      enableNotifications,
      triggerCallAlert
    }),
    [
      queue,
      isReady,
      stats,
      commit,
      audioEnabled,
      notificationsEnabled,
      enableNotifications,
      triggerCallAlert
    ]
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue() {
  const value = useContext(QueueContext);
  if (!value) throw new Error("useQueue must be used inside QueueProvider");
  return value;
}
