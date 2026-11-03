"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { hasScheduledPush, showLocalTimerNotification, syncTimerPush } from "@/lib/push/client";
import { pushEndsAt, shouldNotifyLocally } from "@/lib/push/sync.mjs";

import {
  CARDIO_TIMER_STORAGE_KEY,
  INITIAL_CARDIO_TIMER,
  createBrowserRuntime,
  createTimerStore,
  elapsedTime,
  timerValue,
  type TimerAction,
  type TimerSnapshot,
} from "@/lib/timer";

type CardioTimerContextValue = TimerSnapshot & {
  elapsed: number;
  value: number;
  dispatch: (action: TimerAction) => void;
};
type TimerContextValue = CardioTimerContextValue & {
  startRest: (seconds?: number, label?: string) => void;
  /** Ajusta el aviso push al estado actual del cronómetro (p. ej. justo después de activar los avisos). */
  syncPush: () => void;
};

const TimerContext = createContext<TimerContextValue | null>(null);
const CardioTimerContext = createContext<CardioTimerContextValue | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => createTimerStore());
  // Cronómetro de cardio: otra clave de almacenamiento y siempre ascendente, para no interferir con el de fuerza.
  const [cardioStore] = useState(() => createTimerStore(createBrowserRuntime(CARDIO_TIMER_STORAGE_KEY), {
    initial: INITIAL_CARDIO_TIMER,
    accept: (state) => state.mode === "stopwatch",
  }));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const cardioSnapshot = useSyncExternalStore(cardioStore.subscribe, cardioStore.getSnapshot, cardioStore.getServerSnapshot);
  const previousStatus = useRef(snapshot.timer.status);
  // Fin y nombre del último descanso en marcha: al terminar, el estado ya no los conserva.
  const lastRun = useRef<{ endsAt: number; label: string } | null>(null);

  useEffect(() => {
    const { timer } = snapshot;
    if (previousStatus.current === "running" && timer.status === "finished") {
      navigator.vibrate?.([120, 60, 120]);
      // Respaldo local: solo si no hay un push programado para este fin y el fin es reciente (ver shouldNotifyLocally).
      const run = lastRun.current;
      if (run && shouldNotifyLocally({ run, mode: timer.mode, now: Date.now(), hasPush: hasScheduledPush })) {
        void showLocalTimerNotification(run.label);
      }
    }
    const endsAt = pushEndsAt(timer);
    lastRun.current = endsAt === null ? null : { endsAt, label: timer.label };
    previousStatus.current = timer.status;
  }, [snapshot]);

  // El aviso push se ajusta tras cada acción del usuario, no observando el estado: el estado se sincroniza
  // entre pestañas y cada una programaría el aviso por su cuenta. `syncTimerPush` es idempotente.
  const syncPush = useCallback(() => {
    const current = store.getSnapshot();
    if (current.ready) void syncTimerPush(current.timer);
  }, [store]);

  const dispatch = useCallback((action: TimerAction) => {
    store.dispatch(action);
    if (action.type !== "tick") syncPush();
  }, [store, syncPush]);

  // Al abrir la app y al volver a primer plano se repara un aviso perdido (p. ej. se programó sin conexión).
  useEffect(() => {
    if (snapshot.ready) syncPush();
  }, [snapshot.ready, syncPush]);

  useEffect(() => {
    const repair = () => {
      if (document.visibilityState === "visible") syncPush();
    };
    document.addEventListener("visibilitychange", repair);
    window.addEventListener("focus", repair);
    return () => {
      document.removeEventListener("visibilitychange", repair);
      window.removeEventListener("focus", repair);
    };
  }, [syncPush]);

  const restValue = useMemo<TimerContextValue>(() => ({
    ...snapshot,
    value: timerValue(snapshot.timer, snapshot.now),
    elapsed: elapsedTime(snapshot.timer, snapshot.now),
    dispatch,
    syncPush,
    startRest: (seconds = snapshot.timer.durationMs / 1000, label) => {
      dispatch({ type: "startRest", seconds, label });
    },
  }), [snapshot, dispatch, syncPush]);

  const cardioValue = useMemo<CardioTimerContextValue>(() => ({
    ...cardioSnapshot,
    value: timerValue(cardioSnapshot.timer, cardioSnapshot.now),
    elapsed: elapsedTime(cardioSnapshot.timer, cardioSnapshot.now),
    dispatch: cardioStore.dispatch,
  }), [cardioSnapshot, cardioStore]);

  return (
    <TimerContext.Provider value={restValue}>
      <CardioTimerContext.Provider value={cardioValue}>
        {children}
      </CardioTimerContext.Provider>
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) throw new Error("useTimer requiere TimerProvider.");
  return context;
}

export function useCardioTimer() {
  const context = useContext(CardioTimerContext);
  if (!context) throw new Error("useCardioTimer requiere TimerProvider.");
  return context;
}
