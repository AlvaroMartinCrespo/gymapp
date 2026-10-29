export const TIMER_STORAGE_KEY = "gymapp-timer-v1";
export const MAX_REST_SECONDS = 3600;
export const MAX_ELAPSED_MS = 99 * 60 * 60 * 1000;

export type TimerMode = "rest" | "stopwatch";
export type TimerStatus = "idle" | "running" | "paused" | "finished";
export type TimerState = {
  version: 1;
  mode: TimerMode;
  status: TimerStatus;
  durationMs: number;
  elapsedMs: number;
  startedAt: number | null;
  label: string;
};
export type TimerAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "tick" }
  | { type: "configure"; mode: TimerMode; seconds: number }
  | { type: "startRest"; seconds: number; label?: string }
  | { type: "extend"; seconds: number };

export const INITIAL_TIMER: TimerState = {
  version: 1,
  mode: "rest",
  status: "idle",
  durationMs: 90000,
  elapsedMs: 0,
  startedAt: null,
  label: "Descanso",
};

function validSeconds(seconds: number) {
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= MAX_REST_SECONDS;
}

export function elapsedTime(state: TimerState, now: number): number {
  const active = state.status === "running" && state.startedAt !== null
    ? Math.max(0, now - state.startedAt)
    : 0;
  const limit = state.mode === "rest" ? state.durationMs : MAX_ELAPSED_MS;
  return Math.min(limit, state.elapsedMs + active);
}

export function settleTimer(state: TimerState, now: number): TimerState {
  const limit = state.mode === "rest" ? state.durationMs : MAX_ELAPSED_MS;
  if (state.status === "running" && elapsedTime(state, now) >= limit) {
    return { ...state, status: "finished", elapsedMs: limit, startedAt: null };
  }
  return state;
}

export function timerValue(state: TimerState, now: number): number {
  const elapsed = elapsedTime(state, now);
  return state.mode === "rest" ? state.durationMs - elapsed : elapsed;
}

export function transitionTimer(state: TimerState, action: TimerAction, now: number): TimerState {
  const current = settleTimer(state, now);
  switch (action.type) {
    case "start":
      if (current.status === "running") return current;
      return {
        ...current,
        status: "running",
        elapsedMs: current.status === "finished" ? 0 : current.elapsedMs,
        startedAt: now,
      };
    case "pause":
      return current.status === "running"
        ? { ...current, status: "paused", elapsedMs: elapsedTime(current, now), startedAt: null }
        : current;
    case "reset":
      return { ...current, status: "idle", elapsedMs: 0, startedAt: null };
    case "configure":
      if (!validSeconds(action.seconds) || !["rest", "stopwatch"].includes(action.mode)) return current;
      return {
        ...INITIAL_TIMER,
        mode: action.mode,
        durationMs: action.seconds * 1000,
        label: action.mode === "rest" ? "Descanso" : "Cronómetro",
      };
    case "startRest":
      if (!validSeconds(action.seconds)) return current;
      return {
        ...INITIAL_TIMER,
        status: "running",
        durationMs: action.seconds * 1000,
        startedAt: now,
        label: action.label?.trim().slice(0, 100) || "Descanso",
      };
    case "extend":
      if (current.mode !== "rest" || !["running", "paused"].includes(current.status) || !validSeconds(action.seconds)) return current;
      return { ...current, durationMs: Math.min(MAX_REST_SECONDS * 1000, current.durationMs + action.seconds * 1000) };
    case "tick":
      return current;
  }
}

export function restoreTimer(serialized: string | null, now: number): TimerState {
  if (!serialized) return INITIAL_TIMER;
  try {
    const state = JSON.parse(serialized);
    if (
      !state || state.version !== 1 ||
      !["rest", "stopwatch"].includes(state.mode) ||
      !["idle", "running", "paused", "finished"].includes(state.status) ||
      !validSeconds(state.durationMs / 1000) ||
      !Number.isSafeInteger(state.elapsedMs) || state.elapsedMs < 0 || state.elapsedMs > MAX_ELAPSED_MS ||
      typeof state.label !== "string" || !state.label.trim() || state.label.length > 100 ||
      (state.status === "running"
        ? !Number.isSafeInteger(state.startedAt) || state.startedAt < 0
        : state.startedAt !== null) ||
      (state.status === "idle" && state.elapsedMs !== 0) ||
      (state.mode === "rest" && state.elapsedMs > state.durationMs) ||
      (state.status === "finished" && state.elapsedMs !== (state.mode === "rest" ? state.durationMs : MAX_ELAPSED_MS))
    ) return INITIAL_TIMER;
    return settleTimer({
      version: 1,
      mode: state.mode,
      status: state.status,
      durationMs: state.durationMs,
      elapsedMs: state.elapsedMs,
      startedAt: state.startedAt,
      label: state.label,
    }, now);
  } catch {
    return INITIAL_TIMER;
  }
}

export function formatTimer(milliseconds: number, countdown = false): string {
  const value = Number.isFinite(milliseconds) ? Math.min(MAX_ELAPSED_MS, Math.max(0, milliseconds)) : 0;
  const seconds = countdown ? Math.ceil(value / 1000) : Math.floor(value / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [
    ...(hours > 0 ? [String(hours).padStart(2, "0")] : []),
    String(minutes).padStart(2, "0"),
    String(remainder).padStart(2, "0"),
  ].join(":");
}

export type TimerSnapshot = {
  timer: TimerState;
  now: number;
  ready: boolean;
  persistent: boolean;
};

type TimerRuntime = {
  now: () => number;
  read: () => string | null;
  write: (value: string) => void;
  listen: (onStorage: () => void, onVisible: () => void) => () => void;
  schedule: (callback: () => void) => () => void;
};

const browserRuntime: TimerRuntime = {
  now: () => Date.now(),
  read: () => window.localStorage.getItem(TIMER_STORAGE_KEY),
  write: (value) => window.localStorage.setItem(TIMER_STORAGE_KEY, value),
  listen: (onStorage, onVisible) => {
    const storage = (event: StorageEvent) => {
      if (event.key === TIMER_STORAGE_KEY || event.key === null) onStorage();
    };
    const visible = () => {
      if (document.visibilityState === "visible") onVisible();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  },
  schedule: (callback) => {
    const interval = window.setInterval(callback, 250);
    return () => window.clearInterval(interval);
  },
};

export function createTimerStore(runtime: TimerRuntime = browserRuntime) {
  const serverSnapshot: TimerSnapshot = {
    timer: INITIAL_TIMER,
    now: 0,
    ready: false,
    persistent: true,
  };
  let snapshot = serverSnapshot;
  const listeners = new Set<() => void>();
  let cancelClock: (() => void) | null = null;
  let cancelEvents: (() => void) | null = null;

  function persist(timer: TimerState) {
    try {
      runtime.write(JSON.stringify(timer));
      return true;
    } catch {
      return false;
    }
  }

  function publish(timer: TimerState, now: number, persistent: boolean) {
    snapshot = { timer, now, persistent, ready: true };
    if (timer.status === "running" && listeners.size > 0) {
      cancelClock ??= runtime.schedule(tick);
    } else {
      cancelClock?.();
      cancelClock = null;
    }
    listeners.forEach((listener) => listener());
  }

  function tick() {
    const now = runtime.now();
    const timer = settleTimer(snapshot.timer, now);
    const persistent = timer !== snapshot.timer ? persist(timer) : snapshot.persistent;
    publish(timer, now, persistent);
  }

  function restore() {
    const now = runtime.now();
    try {
      publish(restoreTimer(runtime.read(), now), now, true);
    } catch {
      publish(settleTimer(snapshot.timer, now), now, false);
    }
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        restore();
        cancelEvents = runtime.listen(restore, tick);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          cancelClock?.();
          cancelClock = null;
          cancelEvents?.();
          cancelEvents = null;
        }
      };
    },
    dispatch: (action: TimerAction) => {
      if (!snapshot.ready) restore();
      const now = runtime.now();
      const timer = transitionTimer(snapshot.timer, action, now);
      if (timer !== snapshot.timer) publish(timer, now, persist(timer));
    },
  };
}