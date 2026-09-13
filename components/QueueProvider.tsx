"use client";

import {
  QueueState,
  callNextToken,
  createQueueChannel,
  defaultQueueState,
  issueToken,
  loadQueue,
  resetQueue,
  saveQueue,
  skipCurrentToken,
  updateSettings
} from "@/lib/queue";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type QueueContextValue = {
  queue: QueueState;
  isReady: boolean;
  issue: () => void;
  next: () => void;
  skip: () => void;
  reset: () => void;
  saveSettings: (settings: Pick<QueueState, "clinicName" | "doctorName" | "avgConsultMinutes">) => void;
};

const QueueContext = createContext<QueueContextValue | null>(null);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueState>(defaultQueueState);
  const [isReady, setIsReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof createQueueChannel> | null>(null);

  useEffect(() => {
    setQueue(loadQueue());
    setIsReady(true);
    channelRef.current = createQueueChannel((incoming) => {
      saveQueue(incoming);
      setQueue(incoming);
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key === "tokenflow.queue.v1") setQueue(loadQueue());
    };

    window.addEventListener("storage", onStorage);

    return () => {
      channelRef.current?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const commit = useCallback((updater: (state: QueueState) => QueueState) => {
    setQueue((current) => {
      const nextState = updater(current);
      saveQueue(nextState);
      channelRef.current?.post(nextState);
      return nextState;
    });
  }, []);

  const value = useMemo<QueueContextValue>(
    () => ({
      queue,
      isReady,
      issue: () => commit(issueToken),
      next: () => commit(callNextToken),
      skip: () => commit(skipCurrentToken),
      reset: () => commit(resetQueue),
      saveSettings: (settings) => commit((state) => updateSettings(state, settings))
    }),
    [commit, isReady, queue]
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue() {
  const value = useContext(QueueContext);
  if (!value) throw new Error("useQueue must be used inside QueueProvider");
  return value;
}
