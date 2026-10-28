"use client";

import {
  QueueDynamicStats,
  QueueAction,
  QueueState,
  applyQueueAction,
  calculateDynamicStats,
  createQueueChannel,
  defaultQueueState,
  loadQueue,
  saveQueue,
} from "@/lib/queue";
import type { TokenRecord } from "@/lib/queue";
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
  issue: (patientName?: string, patientPhone?: string, patientAccessKey?: string) => Promise<TokenRecord | undefined>;
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
type QueueMutation = Exclude<QueueAction, { type: "initialize" | "reconcile" }>;

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueState>(defaultQueueState);
  const queueRef = useRef(queue);
  const pendingActionsRef = useRef(0);
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
    queueRef.current = initialQueue;
    setQueue(initialQueue);
    lastProcessedCallRef.current = initialQueue.lastCalledAt;

    const endpoint = "/api/queue";
    const acceptIncoming = (incoming: QueueState, source: "remote" | "local" | "action" = "remote") => {
      if (isQueueSyncConfigured) {
        if (source === "local" || (source === "remote" && pendingActionsRef.current > 0)) return;
        if ((incoming.syncRevision ?? 0) < (queueRef.current.syncRevision ?? 0)) return;
      }
      queueRef.current = incoming;
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
      if (response.status === 401) {
        if (active) window.location.assign(`/login?next=${encodeURIComponent(pathname)}`);
        throw new Error("Staff session expired");
      }
      if (!response.ok) throw new Error("Queue sync unavailable");
      const remoteQueue = (await response.json()) as QueueState | null;
      if (remoteQueue) {
        const mayRecoverLegacyTokens = initialQueue.syncRevision === undefined &&
          (remoteQueue.syncRevision ?? 0) === 0 &&
          initialQueue.totalIssued > remoteQueue.totalIssued &&
          Date.parse(initialQueue.updatedAt) > Date.parse(remoteQueue.updatedAt);
        if (mayRecoverLegacyTokens) {
          const recoveryResponse = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: { type: "reconcile", localState: initialQueue } })
          });
          if (recoveryResponse.ok) {
            const recovered = (await recoveryResponse.json()) as { state?: QueueState };
            if (recovered.state) {
              acceptIncoming(recovered.state);
              return;
            }
          }
        }
        acceptIncoming(remoteQueue);
      } else if (pathname !== "/patient") {
        const seedResponse = await fetch("/api/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: { type: "initialize", state: initialQueue } })
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
      acceptIncoming(incoming, "local");
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

    const fallbackSyncTimer = isQueueSyncConfigured && pathname !== "/patient"
      ? window.setInterval(() => {
          void refreshRemote()
            .then(() => setSyncStatus("live"))
            .catch(() => setSyncStatus("offline"));
        }, 15000)
      : null;

    const onStorage = (event: StorageEvent) => {
      if (event.key === "tokenflow.queue.v1") {
        const fresh = loadQueue();
        acceptIncoming(fresh, "local");
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      channelRef.current?.close();
      unsubscribeRealtime?.();
      if (fallbackSyncTimer) window.clearInterval(fallbackSyncTimer);
      window.removeEventListener("storage", onStorage);
      active = false;
    };
  }, [pathname]);

  const commit = useCallback(async (action: QueueMutation, isCallAction = false): Promise<QueueState> => {
    const optimisticState = applyQueueAction(queueRef.current, action);
    queueRef.current = optimisticState;
    saveQueue(optimisticState);
    setQueue(optimisticState);
    if (!isQueueSyncConfigured) {
      channelRef.current?.post(optimisticState);
    }

    if (isCallAction && optimisticState.lastCalledToken && optimisticState.lastCalledName) {
      lastProcessedCallRef.current = optimisticState.lastCalledAt;
      triggerCallAlert(optimisticState.lastCalledToken, optimisticState.lastCalledName);
    }
    if (!isQueueSyncConfigured) return optimisticState;

    pendingActionsRef.current += 1;
    try {
      const response = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(pathname ?? "/control")}`);
        return optimisticState;
      }
      if (!response.ok) {
        setSyncStatus("offline");
        return optimisticState;
      }
      const result = (await response.json()) as { state?: QueueState };
      if (result.state) {
        const currentRevision = queueRef.current.syncRevision ?? 0;
        if ((result.state.syncRevision ?? 0) >= currentRevision) {
          queueRef.current = result.state;
          saveQueue(result.state);
          setQueue(result.state);
        }
      }
      setSyncStatus("live");
      return result.state ?? optimisticState;
    } catch {
      setSyncStatus("offline");
      return optimisticState;
    } finally {
      pendingActionsRef.current = Math.max(0, pendingActionsRef.current - 1);
    }
  }, [pathname, triggerCallAlert]);

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
      issue: async (patientName, patientPhone, patientAccessKey) => {
        const accessKey = patientAccessKey ?? globalThis.crypto.randomUUID();
        const result = await commit({ type: "issue", patientName, patientPhone, patientAccessKey: accessKey });
        return result.tokens.find((token) => token.patientAccessKey === accessKey);
      },
      next: () => void commit({ type: "next" }, true),
      callSpecific: (tokenNumber) => void commit({ type: "callSpecific", tokenNumber }, true),
      completeCheckup: () => void commit({ type: "complete" }),
      skip: (tokenNumber) => void commit({ type: "skip", tokenNumber }),
      requeue: (tokenNumber) => void commit({ type: "requeue", tokenNumber }),
      cancel: (tokenNumber) => void commit({ type: "cancel", tokenNumber }),
      reset: () => void commit({ type: "reset" }),
      saveSettings: (settings) => void commit({ type: "settings", settings }),
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
