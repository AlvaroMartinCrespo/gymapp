"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

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

  useEffect(() => {
    if (previousStatus.current === "running" && snapshot.timer.status === "finished") {
      navigator.vibrate?.([120, 60, 120]);
    }
    previousStatus.current = snapshot.timer.status;
  }, [snapshot.timer.status]);

  const restValue = useMemo<TimerContextValue>(() => ({
    ...snapshot,
    value: timerValue(snapshot.timer, snapshot.now),
    elapsed: elapsedTime(snapshot.timer, snapshot.now),
    dispatch: store.dispatch,
    startRest: (seconds = snapshot.timer.durationMs / 1000, label) => {
      store.dispatch({ type: "startRest", seconds, label });
    },
  }), [snapshot, store]);

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
