"use client";

export type TokenStatus = "WAITING" | "SERVING" | "COMPLETED" | "SKIPPED" | "CANCELLED";

export type TokenRecord = {
  tokenNumber: number;
  patientName: string;
  patientPhone?: string;
  status: TokenStatus;
  issuedAt: string;
  servedAt?: string;
  completedAt?: string;
  actualDurationMinutes?: number;
  notes?: string;
};

export type QueueState = {
  clinicName: string;
  doctorName: string;
  avgConsultMinutes: number;
  currentToken: number;
  totalIssued: number;
  tokens: TokenRecord[];
  updatedAt: string;
  lastCalledAt?: string;
  lastCalledToken?: number;
  lastCalledName?: string;
};

export type QueueDynamicStats = {
  servingToken: TokenRecord | null;
  waitingTokens: TokenRecord[];
  completedTokens: TokenRecord[];
  skippedTokens: TokenRecord[];
  cancelledTokens: TokenRecord[];
  waitingCount: number;
  completedCount: number;
  skippedCount: number;
  cancelledCount: number;
  effectiveAvgMinutes: number;
  actualAvgMinutes: number | null;
  currentElapsedMinutes: number;
  isOvertime: boolean;
  overtimeMinutes: number;
};

const STORAGE_KEY = "tokenflow.queue.v1";
const CHANNEL_NAME = "tokenflow.queue";
let memoryQueue: QueueState | null = null;

export const defaultQueueState: QueueState = {
  clinicName: "TokenFlow Clinic",
  doctorName: "Dr. Nilesh Mehta",
  avgConsultMinutes: 8,
  currentToken: 0,
  totalIssued: 0,
  tokens: [],
  updatedAt: new Date().toISOString()
};

export function loadQueue(): QueueState {
  if (typeof window === "undefined") return defaultQueueState;

  const storage = getStorage();
  let rawState: QueueState | null = null;

  if (storage) {
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved) {
        rawState = JSON.parse(saved);
      }
    } catch {
      rawState = null;
    }
  }

  if (!rawState) {
    rawState = memoryQueue ?? loadCookieQueue() ?? defaultQueueState;
  }

  // Defensively ensure backwards compatibility with older stored data
  return {
    ...defaultQueueState,
    ...rawState,
    tokens: (Array.isArray(rawState?.tokens) ? rawState.tokens : []).map((t) => ({
      ...t,
      patientName: t.patientName || `Patient #${t.tokenNumber}`,
      status: (t.status as TokenStatus) || "WAITING"
    }))
  };
}

export function saveQueue(state: QueueState) {
  if (typeof window === "undefined") return;
  memoryQueue = state;
  const storage = getStorage();
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep the in-memory queue usable when browser storage is full or unavailable.
  }
  saveCookieQueue(state);
}

export function createQueueChannel(onMessage: (state: QueueState) => void) {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return {
      post: (_state: QueueState) => undefined,
      close: () => undefined
    };
  }

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event) => onMessage(event.data as QueueState);

  return {
    post: (state: QueueState) => channel.postMessage(state),
    close: () => channel.close()
  };
}

export function issueToken(
  state: QueueState,
  patientName?: string,
  patientPhone?: string
): QueueState {
  const nextToken = state.totalIssued + 1;
  const cleanName =
    patientName && patientName.trim().length > 0 ? patientName.trim() : `Patient #${nextToken}`;
  const cleanPhone = patientPhone ? patientPhone.trim() : undefined;

  return touch({
    ...state,
    totalIssued: nextToken,
    tokens: [
      ...state.tokens,
      {
        tokenNumber: nextToken,
        patientName: cleanName,
        patientPhone: cleanPhone,
        status: "WAITING",
        issuedAt: new Date().toISOString()
      }
    ]
  });
}

export function callNextToken(state: QueueState): QueueState {
  // Find the next waiting token in chronological order
  const nextWaiting = state.tokens.find((t) => t.status === "WAITING");
  if (!nextWaiting) return touch(state);

  const now = new Date().toISOString();

  return touch({
    ...state,
    currentToken: nextWaiting.tokenNumber,
    lastCalledAt: now,
    lastCalledToken: nextWaiting.tokenNumber,
    lastCalledName: nextWaiting.patientName,
    tokens: state.tokens.map((token) => {
      // If there was a currently serving patient, automatically mark them completed
      if (token.status === "SERVING") {
        const actualDurationMinutes = token.servedAt
          ? Math.max(1, Math.round((new Date(now).getTime() - new Date(token.servedAt).getTime()) / 60000))
          : state.avgConsultMinutes;

        return {
          ...token,
          status: "COMPLETED",
          completedAt: now,
          actualDurationMinutes
        };
      }

      if (token.tokenNumber === nextWaiting.tokenNumber) {
        return {
          ...token,
          status: "SERVING",
          servedAt: now
        };
      }

      return token;
    })
  });
}

export function callSpecificToken(state: QueueState, tokenNumber: number): QueueState {
  const target = state.tokens.find((t) => t.tokenNumber === tokenNumber);
  if (!target || target.status === "CANCELLED") return touch(state);

  const now = new Date().toISOString();

  return touch({
    ...state,
    currentToken: tokenNumber,
    lastCalledAt: now,
    lastCalledToken: tokenNumber,
    lastCalledName: target.patientName,
    tokens: state.tokens.map((token) => {
      if (token.status === "SERVING" && token.tokenNumber !== tokenNumber) {
        const actualDurationMinutes = token.servedAt
          ? Math.max(1, Math.round((new Date(now).getTime() - new Date(token.servedAt).getTime()) / 60000))
          : state.avgConsultMinutes;

        return {
          ...token,
          status: "COMPLETED",
          completedAt: now,
          actualDurationMinutes
        };
      }

      if (token.tokenNumber === tokenNumber) {
        return {
          ...token,
          status: "SERVING",
          servedAt: now
        };
      }

      return token;
    })
  });
}

export function completeCurrentCheckup(state: QueueState): QueueState {
  const now = new Date().toISOString();
  let hasServing = false;

  const updatedTokens = state.tokens.map((token) => {
    if (token.status === "SERVING") {
      hasServing = true;
      const actualDurationMinutes = token.servedAt
        ? Math.max(1, Math.round((new Date(now).getTime() - new Date(token.servedAt).getTime()) / 60000))
        : state.avgConsultMinutes;

      return {
        ...token,
        status: "COMPLETED" as TokenStatus,
        completedAt: now,
        actualDurationMinutes
      };
    }
    return token;
  });

  if (!hasServing) return touch(state);

  return touch({
    ...state,
    currentToken: 0, // Consultation room is cleared and ready for next patient
    tokens: updatedTokens
  });
}

export function skipCurrentToken(state: QueueState, tokenNumber?: number): QueueState {
  const targetToken = tokenNumber ?? state.currentToken;
  if (!targetToken) return touch(state);

  const isCurrentServing = state.currentToken === targetToken;

  return touch({
    ...state,
    currentToken: isCurrentServing ? 0 : state.currentToken,
    tokens: state.tokens.map((token) => {
      if (token.tokenNumber === targetToken) {
        return { ...token, status: "SKIPPED" };
      }
      return token;
    })
  });
}

export function requeueToken(state: QueueState, tokenNumber: number): QueueState {
  return touch({
    ...state,
    tokens: state.tokens.map((token) => {
      if (token.tokenNumber === tokenNumber) {
        return { ...token, status: "WAITING" };
      }
      return token;
    })
  });
}

export function cancelToken(state: QueueState, tokenNumber: number): QueueState {
  const isCurrentServing = state.currentToken === tokenNumber;

  return touch({
    ...state,
    currentToken: isCurrentServing ? 0 : state.currentToken,
    tokens: state.tokens.map((token) => {
      if (token.tokenNumber === tokenNumber) {
        return { ...token, status: "CANCELLED" };
      }
      return token;
    })
  });
}

export function resetQueue(state: QueueState): QueueState {
  return touch({
    ...state,
    currentToken: 0,
    totalIssued: 0,
    tokens: [],
    lastCalledAt: undefined,
    lastCalledToken: undefined,
    lastCalledName: undefined
  });
}

export function updateSettings(
  state: QueueState,
  settings: Pick<QueueState, "clinicName" | "doctorName" | "avgConsultMinutes">
): QueueState {
  return touch({ ...state, ...settings });
}

export function calculateDynamicStats(state: QueueState, nowMs = Date.now()): QueueDynamicStats {
  const servingToken = state.tokens.find((t) => t.status === "SERVING") ?? null;
  const waitingTokens = state.tokens.filter((t) => t.status === "WAITING");
  const completedTokens = state.tokens.filter((t) => t.status === "COMPLETED");
  const skippedTokens = state.tokens.filter((t) => t.status === "SKIPPED");
  const cancelledTokens = state.tokens.filter((t) => t.status === "CANCELLED");

  // Calculate actual average of completed checkups today
  const durations = completedTokens
    .map((t) => t.actualDurationMinutes)
    .filter((d): d is number => typeof d === "number" && d > 0);

  let actualAvgMinutes: number | null = null;
  let effectiveAvgMinutes = state.avgConsultMinutes;

  if (durations.length > 0) {
    const sum = durations.reduce((acc, curr) => acc + curr, 0);
    actualAvgMinutes = Math.round(sum / durations.length);
    // Weighted blend: 30% baseline setup, 70% actual real-world doctor pace today
    effectiveAvgMinutes = Math.max(2, Math.round(state.avgConsultMinutes * 0.3 + actualAvgMinutes * 0.7));
  }

  let currentElapsedMinutes = 0;
  let isOvertime = false;
  let overtimeMinutes = 0;

  if (servingToken && servingToken.servedAt) {
    const elapsedMs = Math.max(0, nowMs - new Date(servingToken.servedAt).getTime());
    currentElapsedMinutes = Math.floor(elapsedMs / 60000);
    if (currentElapsedMinutes > effectiveAvgMinutes) {
      isOvertime = true;
      overtimeMinutes = currentElapsedMinutes - effectiveAvgMinutes;
    }
  }

  return {
    servingToken,
    waitingTokens,
    completedTokens,
    skippedTokens,
    cancelledTokens,
    waitingCount: waitingTokens.length,
    completedCount: completedTokens.length,
    skippedCount: skippedTokens.length,
    cancelledCount: cancelledTokens.length,
    effectiveAvgMinutes,
    actualAvgMinutes,
    currentElapsedMinutes,
    isOvertime,
    overtimeMinutes
  };
}

export function estimateDynamicWait(
  state: QueueState,
  patientToken: number,
  nowMs = Date.now()
): {
  waitMinutes: number;
  patientsAhead: number;
  status: TokenStatus | "NOT_FOUND";
  isOvertime: boolean;
  overtimeMinutes: number;
  effectiveAvgMinutes: number;
} {
  const token = state.tokens.find((t) => t.tokenNumber === patientToken);
  const stats = calculateDynamicStats(state, nowMs);

  if (!token) {
    return {
      waitMinutes: 0,
      patientsAhead: 0,
      status: "NOT_FOUND",
      isOvertime: false,
      overtimeMinutes: 0,
      effectiveAvgMinutes: stats.effectiveAvgMinutes
    };
  }

  if (token.status === "SERVING") {
    return {
      waitMinutes: 0,
      patientsAhead: 0,
      status: "SERVING",
      isOvertime: stats.isOvertime,
      overtimeMinutes: stats.overtimeMinutes,
      effectiveAvgMinutes: stats.effectiveAvgMinutes
    };
  }

  if (token.status === "COMPLETED" || token.status === "SKIPPED" || token.status === "CANCELLED") {
    return {
      waitMinutes: 0,
      patientsAhead: 0,
      status: token.status,
      isOvertime: false,
      overtimeMinutes: 0,
      effectiveAvgMinutes: stats.effectiveAvgMinutes
    };
  }

  const waitingTokens = stats.waitingTokens;
  const tokenIndexInWaiting = waitingTokens.findIndex((t) => t.tokenNumber === patientToken);
  const patientsAhead = tokenIndexInWaiting >= 0 ? tokenIndexInWaiting : 0;

  // Remaining time for current patient in room
  let remainingCurrentMinutes = 0;
  if (stats.servingToken) {
    if (stats.currentElapsedMinutes < stats.effectiveAvgMinutes) {
      remainingCurrentMinutes = Math.max(1, stats.effectiveAvgMinutes - stats.currentElapsedMinutes);
    } else {
      // Current patient is overtime! Buffer remaining for conclusion:
      remainingCurrentMinutes = Math.max(2, Math.round(stats.effectiveAvgMinutes * 0.25));
    }
  }

  // Dynamic wait: remaining time for current patient + (patients ahead in queue * effective pace)
  const waitMinutes = remainingCurrentMinutes + patientsAhead * stats.effectiveAvgMinutes;

  return {
    waitMinutes,
    patientsAhead,
    status: token.status,
    isOvertime: stats.isOvertime,
    overtimeMinutes: stats.overtimeMinutes,
    effectiveAvgMinutes: stats.effectiveAvgMinutes
  };
}

// Deprecated legacy wrapper kept for backwards compatibility
export function estimateWaitMinutes(state: QueueState, patientToken: number) {
  return estimateDynamicWait(state, patientToken).waitMinutes;
}

function touch(state: QueueState): QueueState {
  return { ...state, updatedAt: new Date().toISOString() };
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadCookieQueue() {
  try {
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${STORAGE_KEY}=`))
      ?.split("=")[1];

    return cookie ? ({ ...defaultQueueState, ...JSON.parse(decodeURIComponent(cookie)) } as QueueState) : null;
  } catch {
    return null;
  }
}

function saveCookieQueue(state: QueueState) {
  try {
    document.cookie = `${STORAGE_KEY}=${encodeURIComponent(JSON.stringify(state))}; path=/; max-age=86400; SameSite=Lax`;
  } catch {
    // Storage is best-effort for a local pilot.
  }
}
