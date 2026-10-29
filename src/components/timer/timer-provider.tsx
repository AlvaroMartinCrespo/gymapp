"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { createTimerStore, elapsedTime, timerValue, type TimerAction, type TimerSnapshot } from "@/lib/timer";

type TimerContextValue = TimerSnapshot & {
  elapsed: number;
  value: number;
  dispatch: (action: TimerAction) => void;
  startRest: (seconds?: number, label?: string) => void;
};

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => createTimerStore());
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const previousStatus = useRef(snapshot.timer.status);

  useEffect(() => {
    if (previousStatus.current === "running" && snapshot.timer.status === "finished") {
      navigator.vibrate?.([120, 60, 120]);
    }
    previousStatus.current = snapshot.timer.status;
  }, [snapshot.timer.status]);

  return (
    <TimerContext.Provider value={{
      ...snapshot,
      value: timerValue(snapshot.timer, snapshot.now),
      elapsed: elapsedTime(snapshot.timer, snapshot.now),
      dispatch: store.dispatch,
      startRest: (seconds = snapshot.timer.durationMs / 1000, label) => {
        store.dispatch({ type: "startRest", seconds, label });
      },
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) throw new Error("useTimer requiere TimerProvider.");
  return context;
}