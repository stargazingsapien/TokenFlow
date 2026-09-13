"use client";

export type TokenStatus = "WAITING" | "SERVING" | "COMPLETED" | "SKIPPED";

export type TokenRecord = {
  tokenNumber: number;
  status: TokenStatus;
  issuedAt: string;
  servedAt?: string;
};

export type QueueState = {
  clinicName: string;
  doctorName: string;
  avgConsultMinutes: number;
  currentToken: number;
  totalIssued: number;
  tokens: TokenRecord[];
  updatedAt: string;
};

const STORAGE_KEY = "tokenflow.queue.v1";
const CHANNEL_NAME = "tokenflow.queue";
let memoryQueue: QueueState | null = null;

export const defaultQueueState: QueueState = {
  clinicName: "TokenFlow Clinic",
  doctorName: "Consultant",
  avgConsultMinutes: 8,
  currentToken: 0,
  totalIssued: 0,
  tokens: [],
  updatedAt: new Date().toISOString()
};

export function loadQueue(): QueueState {
  if (typeof window === "undefined") return defaultQueueState;

  const storage = getStorage();
  if (!storage) return memoryQueue ?? loadCookieQueue() ?? defaultQueueState;

  const saved = storage.getItem(STORAGE_KEY);
  if (!saved) return loadCookieQueue() ?? defaultQueueState;

  try {
    return { ...defaultQueueState, ...JSON.parse(saved) };
  } catch {
    return defaultQueueState;
  }
}

export function saveQueue(state: QueueState) {
  if (typeof window === "undefined") return;
  memoryQueue = state;
  const storage = getStorage();
  storage?.setItem(STORAGE_KEY, JSON.stringify(state));
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

export function issueToken(state: QueueState): QueueState {
  const nextToken = state.totalIssued + 1;

  return touch({
    ...state,
    totalIssued: nextToken,
    tokens: [
      ...state.tokens,
      {
        tokenNumber: nextToken,
        status: "WAITING",
        issuedAt: new Date().toISOString()
      }
    ]
  });
}

export function callNextToken(state: QueueState): QueueState {
  const nextToken = Math.min(state.currentToken + 1, state.totalIssued);
  if (nextToken === state.currentToken) return touch(state);

  return touch({
    ...state,
    currentToken: nextToken,
    tokens: state.tokens.map((token) => {
      if (token.tokenNumber < nextToken && token.status !== "SKIPPED") {
        return { ...token, status: "COMPLETED" };
      }

      if (token.tokenNumber === nextToken) {
        return { ...token, status: "SERVING", servedAt: new Date().toISOString() };
      }

      return token.status === "SERVING" ? { ...token, status: "COMPLETED" } : token;
    })
  });
}

export function skipCurrentToken(state: QueueState): QueueState {
  if (state.currentToken === 0) return touch(state);

  return touch({
    ...state,
    tokens: state.tokens.map((token) =>
      token.tokenNumber === state.currentToken ? { ...token, status: "SKIPPED" } : token
    )
  });
}

export function resetQueue(state: QueueState): QueueState {
  return touch({
    ...state,
    currentToken: 0,
    totalIssued: 0,
    tokens: []
  });
}

export function updateSettings(
  state: QueueState,
  settings: Pick<QueueState, "clinicName" | "doctorName" | "avgConsultMinutes">
): QueueState {
  return touch({ ...state, ...settings });
}

export function estimateWaitMinutes(state: QueueState, patientToken: number) {
  const tokenGap = Math.max(patientToken - Math.max(state.currentToken, 0), 0);
  return tokenGap * state.avgConsultMinutes;
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
