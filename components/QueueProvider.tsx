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
import { isQueueSyncConfigured, publicQueueSignalRef } from "@/lib/firebase";
import { onSnapshot } from "firebase/firestore";
import { useI18n } from "./I18nProvider";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type QueueContextValue = {
  queue: QueueState;
  isReady: boolean;
  syncStatus: "local" | "connecting" | "live" | "offline";
  stats: QueueDynamicStats;
  issue: (patientName?: string, patientPhone?: string, patientAccessKey?: string) => void;
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
  const [syncStatus, setSyncStatus] = useState<QueueContextValue["syncStatus"]>(
    isQueueSyncConfigured ? "connecting" : "local"
  );
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const channelRef = useRef<ReturnType<typeof createQueueChannel> | null>(null);
  const lastProcessedCallRef = useRef<string | undefined>(undefined);
  const { language } = useI18n();
  const pathname = usePathname();
  const triggerCallAlertRef = useRef<(tokenNumber: number, patientName: string) => void>(() => undefined);

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
    triggerCallAlertRef.current = triggerCallAlert;
  }, [triggerCallAlert]);

  useEffect(() => {
    const initialQueue = loadQueue();
    setQueue(initialQueue);
    lastProcessedCallRef.current = initialQueue.lastCalledAt;

    const endpoint = "/api/queue";
    const acceptIncoming = (incoming: QueueState) => {
      saveQueue(incoming);
      setQueue(incoming);
      if (incoming.lastCalledAt && incoming.lastCalledAt !== lastProcessedCallRef.current) {
        lastProcessedCallRef.current = incoming.lastCalledAt;
        if (incoming.lastCalledToken && incoming.lastCalledName) {
          triggerCallAlertRef.current(incoming.lastCalledToken, incoming.lastCalledName);
        }
      }
    };
    const refreshRemote = async () => {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error("Queue sync unavailable");
      const remoteQueue = (await response.json()) as QueueState | null;
      if (remoteQueue) {
        acceptIncoming(remoteQueue);
      } else if (pathname !== "/patient") {
        const seedResponse = await fetch("/api/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initialQueue)
        });
        if (!seedResponse.ok) throw new Error("Could not initialize the clinic queue");
        const seeded = (await seedResponse.json()) as { state?: QueueState };
        if (seeded.state) acceptIncoming(seeded.state);
      }
    };

    let active = true;
    if (isQueueSyncConfigured && pathname !== "/patient") {
      void refreshRemote()
        .then(() => {
          if (active) setSyncStatus("live");
        })
        .catch(() => {
          if (active) setSyncStatus("offline");
        })
        .finally(() => {
          if (active) setIsReady(true);
        });
    } else {
      setIsReady(true);
      if (!isQueueSyncConfigured) setSyncStatus("local");
    }

    channelRef.current = createQueueChannel((incoming) => {
      acceptIncoming(incoming);
    });

    const unsubscribeRealtime = isQueueSyncConfigured && pathname !== "/patient" && publicQueueSignalRef
      ? onSnapshot(
          publicQueueSignalRef,
          () => {
            void refreshRemote().then(() => setSyncStatus("live")).catch(() => setSyncStatus("offline"));
          },
          () => setSyncStatus("offline")
        )
      : null;

    const onStorage = (event: StorageEvent) => {
      if (event.key === "tokenflow.queue.v1") {
        const fresh = loadQueue();
        acceptIncoming(fresh);
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      channelRef.current?.close();
      unsubscribeRealtime?.();
      window.removeEventListener("storage", onStorage);
      active = false;
    };
  }, [pathname]);

  const commit = useCallback(
    (updater: (state: QueueState) => QueueState, isCallAction = false) => {
      setQueue((current) => {
        const nextState = updater(current);
        saveQueue(nextState);
        channelRef.current?.post(nextState);
        if (isQueueSyncConfigured) {
          void fetch("/api/queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextState)
          }).then(async (response) => {
            if (!response.ok) {
              setSyncStatus("offline");
              return;
            }
            const result = (await response.json()) as { state?: QueueState };
            if (result.state) {
              saveQueue(result.state);
              setQueue(result.state);
            }
            setSyncStatus("live");
          }).catch(() => setSyncStatus("offline"));
        }

        if (isCallAction && nextState.lastCalledToken && nextState.lastCalledName) {
          lastProcessedCallRef.current = nextState.lastCalledAt;
          triggerCallAlert(nextState.lastCalledToken, nextState.lastCalledName);
        }

        return nextState;
      });
    },
    [triggerCallAlert]
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
      syncStatus,
      stats,
      issue: (patientName, patientPhone, patientAccessKey) =>
        commit((state) => issueToken(state, patientName, patientPhone, patientAccessKey)),
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
      syncStatus,
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
