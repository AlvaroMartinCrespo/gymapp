import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INITIAL_TIMER,
  MAX_ELAPSED_MS,
  createTimerStore,
  elapsedTime,
  formatTimer,
  restoreTimer,
  settleTimer,
  timerValue,
  transitionTimer,
} from "../src/lib/timer.ts";

test("la cuenta atrás recupera el tiempo real aunque no haya ticks", () => {
  const state = transitionTimer(INITIAL_TIMER, { type: "start" }, 1000);
  assert.equal(timerValue(state, 31000), 60000);
  const finished = settleTimer(state, 301000);
  assert.equal(finished.status, "finished");
  assert.equal(timerValue(finished, 301000), 0);
  assert.equal(finished.startedAt, null);
});

test("pausar y reanudar no cuenta el tiempo transcurrido en pausa", () => {
  const running = transitionTimer(INITIAL_TIMER, { type: "start" }, 1000);
  const paused = transitionTimer(running, { type: "pause" }, 31000);
  assert.equal(paused.status, "paused");
  assert.equal(timerValue(paused, 300000), 60000);
  const resumed = transitionTimer(paused, { type: "start" }, 300000);
  assert.equal(timerValue(resumed, 320000), 40000);
});

test("recargar recupera sesiones activas, pausadas y ya terminadas", () => {
  const running = transitionTimer(INITIAL_TIMER, { type: "start" }, 1000);
  assert.equal(timerValue(restoreTimer(JSON.stringify(running), 41000), 41000), 50000);
  assert.equal(restoreTimer(JSON.stringify(running), 301000).status, "finished");
  const paused = transitionTimer(running, { type: "pause" }, 11000);
  assert.deepEqual(restoreTimer(JSON.stringify(paused), 301000), paused);
});

test("el cronómetro ascendente conserva tiempo entre bloqueos y pausas", () => {
  const configured = transitionTimer(INITIAL_TIMER, { type: "configure", mode: "stopwatch", seconds: 90 }, 1000);
  const running = transitionTimer(configured, { type: "start" }, 1000);
  assert.equal(timerValue(running, 601000), 600000);
  const paused = transitionTimer(running, { type: "pause" }, 601000);
  const resumed = transitionTimer(paused, { type: "start" }, 701000);
  assert.equal(timerValue(resumed, 711000), 610000);
});

test("reiniciar conserva el modo y la duración, repetir empieza desde cero", () => {
  const running = transitionTimer(INITIAL_TIMER, { type: "startRest", seconds: 120, label: "Press de banca" }, 1000);
  const reset = transitionTimer(running, { type: "reset" }, 31000);
  assert.equal(reset.durationMs, 120000);
  assert.equal(reset.status, "idle");
  assert.equal(reset.label, "Press de banca");
  const finished = settleTimer(running, 121000);
  const repeated = transitionTimer(finished, { type: "start" }, 200000);
  assert.equal(repeated.status, "running");
  assert.equal(timerValue(repeated, 200000), 120000);
});

test("guardar una serie puede activar un nuevo descanso con el nombre del ejercicio", () => {
  const state = transitionTimer(INITIAL_TIMER, { type: "startRest", seconds: 60, label: "  Remo con barra  " }, 1000);
  assert.equal(state.status, "running");
  assert.equal(state.label, "Remo con barra");
  assert.equal(timerValue(state, 11000), 50000);
});

test("añadir tiempo conserva el tiempo ya transcurrido y limita el descanso a una hora", () => {
  const running = transitionTimer(INITIAL_TIMER, { type: "start" }, 1000);
  const extended = transitionTimer(running, { type: "extend", seconds: 30 }, 31000);
  assert.equal(timerValue(extended, 31000), 90000);
  const capped = transitionTimer(extended, { type: "extend", seconds: 3600 }, 31000);
  assert.equal(capped.durationMs, 3600000);
  assert.equal(capped.startedAt, 1000);
});

test("ignora configuraciones inválidas y no genera tiempos negativos", () => {
  for (const seconds of [0, -1, 1.5, 3601, NaN, Infinity]) {
    assert.deepEqual(transitionTimer(INITIAL_TIMER, { type: "startRest", seconds }, 1000), INITIAL_TIMER);
  }
  const running = transitionTimer(INITIAL_TIMER, { type: "start" }, 1000);
  assert.equal(elapsedTime(running, 0), 0);
  assert.equal(timerValue(running, 999999), 0);
});

test("localStorage corrupto o incompatible vuelve al estado inicial", () => {
  for (const serialized of [null, "", "bad-json", "null", "[]", "{}", JSON.stringify({ ...INITIAL_TIMER, version: 2 })]) {
    assert.deepEqual(restoreTimer(serialized, 1000), INITIAL_TIMER);
  }
  for (const changes of [
    { durationMs: 0 }, { elapsedMs: -1 }, { startedAt: 1 },
    { status: "running", startedAt: null }, { label: "" },
    { status: "finished", elapsedMs: 0 }, { mode: "other" },
  ]) {
    assert.deepEqual(restoreTimer(JSON.stringify({ ...INITIAL_TIMER, ...changes }), 1000), INITIAL_TIMER);
  }
});

test("el formato redondea la cuenta atrás sin mostrar cero antes de terminar", () => {
  assert.equal(formatTimer(59999, true), "01:00");
  assert.equal(formatTimer(1, true), "00:01");
  assert.equal(formatTimer(59999), "00:59");
  assert.equal(formatTimer(3661000), "01:01:01");
  assert.equal(formatTimer(-1000), "00:00");
  assert.equal(formatTimer(NaN), "00:00");
  assert.equal(formatTimer(MAX_ELAPSED_MS), "99:00:00");
});

test("el cronómetro tiene un límite seguro de 99 horas", () => {
  const configured = transitionTimer(INITIAL_TIMER, { type: "configure", mode: "stopwatch", seconds: 90 }, 1000);
  const running = transitionTimer(configured, { type: "start" }, 1000);
  const finished = settleTimer(running, MAX_ELAPSED_MS + 1000);
  assert.equal(finished.status, "finished");
  assert.equal(finished.elapsedMs, MAX_ELAPSED_MS);
});

function runtimeFixture() {
  let time = 1000;
  let stored = null;
  let writes = 0;
  let interval = null;
  let storageEvent = null;
  let visibleEvent = null;
  const runtime = {
    now: () => time,
    read: () => stored,
    write: (value) => { stored = value; writes += 1; },
    listen: (onStorage, onVisible) => {
      storageEvent = onStorage;
      visibleEvent = onVisible;
      return () => { storageEvent = null; visibleEvent = null; };
    },
    schedule: (callback) => {
      interval = callback;
      return () => { interval = null; };
    },
  };
  return {
    runtime,
    setTime: (value) => { time = value; },
    setStored: (value) => { stored = value; },
    tick: () => interval?.(),
    storage: () => storageEvent?.(),
    visible: () => visibleEvent?.(),
    writes: () => writes,
    active: () => interval !== null,
    listening: () => storageEvent !== null,
  };
}

test("el store tiene snapshot SSR estable y solo escribe cambios, no cada tick", () => {
  const fixture = runtimeFixture();
  const store = createTimerStore(fixture.runtime);
  assert.equal(store.getServerSnapshot(), store.getServerSnapshot());
  assert.equal(store.getSnapshot().ready, false);
  const unsubscribe = store.subscribe(() => {});
  assert.equal(store.getSnapshot().ready, true);
  store.dispatch({ type: "start" });
  assert.equal(fixture.writes(), 1);
  fixture.setTime(11000);
  fixture.tick();
  assert.equal(fixture.writes(), 1);
  assert.equal(timerValue(store.getSnapshot().timer, store.getSnapshot().now), 80000);
  fixture.setTime(100000);
  fixture.tick();
  assert.equal(store.getSnapshot().timer.status, "finished");
  assert.equal(fixture.writes(), 2);
  assert.equal(fixture.active(), false);
  unsubscribe();
  assert.equal(fixture.listening(), false);
});

test("la sincronización entre pestañas no vuelve a escribir ni genera bucles", () => {
  const fixture = runtimeFixture();
  const store = createTimerStore(fixture.runtime);
  const unsubscribe = store.subscribe(() => {});
  const external = transitionTimer(INITIAL_TIMER, { type: "startRest", seconds: 180 }, 1000);
  fixture.setStored(JSON.stringify(external));
  fixture.setTime(61000);
  fixture.storage();
  assert.equal(timerValue(store.getSnapshot().timer, store.getSnapshot().now), 120000);
  assert.equal(fixture.writes(), 0);
  fixture.setStored(null);
  fixture.storage();
  assert.equal(store.getSnapshot().timer.status, "idle");
  assert.equal(fixture.active(), false);
  unsubscribe();
});

test("un navegador sin almacenamiento mantiene el tiempo en memoria al recuperar el foco", () => {
  const fixture = runtimeFixture();
  fixture.runtime.read = () => { throw new Error("Storage blocked"); };
  fixture.runtime.write = () => { throw new Error("Quota exceeded"); };
  const store = createTimerStore(fixture.runtime);
  const unsubscribe = store.subscribe(() => {});
  assert.equal(store.getSnapshot().persistent, false);
  store.dispatch({ type: "start" });
  fixture.setTime(41000);
  fixture.visible();
  assert.equal(store.getSnapshot().timer.status, "running");
  assert.equal(timerValue(store.getSnapshot().timer, store.getSnapshot().now), 50000);
  assert.equal(store.getSnapshot().persistent, false);
  unsubscribe();
});

test("el reloj se detiene al pausar y los suscriptores comparten un único intervalo", () => {
  const fixture = runtimeFixture();
  const store = createTimerStore(fixture.runtime);
  const first = store.subscribe(() => {});
  const second = store.subscribe(() => {});
  store.dispatch({ type: "start" });
  first();
  assert.equal(fixture.active(), true);
  store.dispatch({ type: "pause" });
  assert.equal(fixture.active(), false);
  second();
  assert.equal(fixture.listening(), false);
});