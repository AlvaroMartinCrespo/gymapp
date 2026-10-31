import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CARDIO_TIMER_STORAGE_KEY,
  INITIAL_CARDIO_TIMER,
  INITIAL_TIMER,
  MAX_ELAPSED_MS,
  TIMER_STORAGE_KEY,
  createTimerStore,
  elapsedTime,
  restoreTimer,
  timerValue,
  transitionTimer,
} from "../src/lib/timer.ts";

const HOUR = 3600000;
const accept = (state) => state.mode === "stopwatch";
const cardioOptions = { initial: INITIAL_CARDIO_TIMER, accept };

// Almacenamiento simulado: `disk` sobrevive a "recargas" (nuevos stores sobre el mismo disco).
function runtimeFixture(disk = { value: null }, clock = { time: 1000 }) {
  let interval = null;
  let storageEvent = null;
  let writes = 0;
  const runtime = {
    now: () => clock.time,
    read: () => disk.value,
    write: (value) => { disk.value = value; writes += 1; },
    listen: (onStorage) => { storageEvent = onStorage; return () => { storageEvent = null; }; },
    schedule: (callback) => { interval = callback; return () => { interval = null; }; },
  };
  return { runtime, disk, clock, tick: () => interval?.(), storage: () => storageEvent?.(), writes: () => writes };
}

test("el cronómetro de cardio usa su propia clave de almacenamiento", () => {
  assert.notEqual(CARDIO_TIMER_STORAGE_KEY, TIMER_STORAGE_KEY);
  assert.equal(INITIAL_CARDIO_TIMER.mode, "stopwatch");
  assert.equal(INITIAL_CARDIO_TIMER.status, "idle");
});

test("startStopwatch arranca un cronómetro ascendente con etiqueta, ignorando el estado anterior", () => {
  const rest = transitionTimer(INITIAL_TIMER, { type: "startRest", seconds: 120, label: "Press banca" }, 1000);
  const started = transitionTimer(rest, { type: "startStopwatch", label: "  Correr  " }, 5000);
  assert.equal(started.mode, "stopwatch");
  assert.equal(started.status, "running");
  assert.equal(started.label, "Correr");
  assert.equal(timerValue(started, 65000), 60000);
  assert.equal(transitionTimer(INITIAL_CARDIO_TIMER, { type: "startStopwatch" }, 0).label, "Cronómetro");
  assert.equal(transitionTimer(INITIAL_CARDIO_TIMER, { type: "startStopwatch", label: "x".repeat(300) }, 0).label.length, 100);
});

test("iniciar, pausar, cerrar la app, volver y terminar no pierde el tiempo", () => {
  const disk = { value: null };
  const clock = { time: 1000 };
  const first = createTimerStore(runtimeFixture(disk, clock).runtime, cardioOptions);
  const unsubscribe = first.subscribe(() => {});
  first.dispatch({ type: "startStopwatch", label: "Correr" });
  clock.time = 1000 + 20 * 60000; // 20 min corriendo
  first.dispatch({ type: "pause" });
  unsubscribe(); // se cierra la app
  clock.time += 5 * HOUR; // horas después

  const second = createTimerStore(runtimeFixture(disk, clock).runtime, cardioOptions);
  const unsubscribeSecond = second.subscribe(() => {});
  const { timer, now } = second.getSnapshot();
  assert.equal(timer.status, "paused");
  assert.equal(timer.label, "Correr");
  assert.equal(elapsedTime(timer, now), 20 * 60000);
  unsubscribeSecond();
});

test("un cronómetro en marcha sigue contando mientras la app está cerrada", () => {
  const disk = { value: null };
  const clock = { time: 1000 };
  const first = createTimerStore(runtimeFixture(disk, clock).runtime, cardioOptions);
  const unsubscribe = first.subscribe(() => {});
  first.dispatch({ type: "startStopwatch", label: "Caminar" });
  unsubscribe();
  clock.time += 45 * 60000;
  const second = createTimerStore(runtimeFixture(disk, clock).runtime, cardioOptions);
  second.subscribe(() => {});
  assert.equal(second.getSnapshot().timer.status, "running");
  assert.equal(elapsedTime(second.getSnapshot().timer, second.getSnapshot().now), 45 * 60000);
});

test("los cronómetros de fuerza y cardio activos a la vez no se interfieren", () => {
  const clock = { time: 1000 };
  const restFixture = runtimeFixture({ value: null }, clock);
  const cardioFixture = runtimeFixture({ value: null }, clock);
  const rest = createTimerStore(restFixture.runtime);
  const cardio = createTimerStore(cardioFixture.runtime, cardioOptions);
  rest.subscribe(() => {});
  cardio.subscribe(() => {});
  cardio.dispatch({ type: "startStopwatch", label: "Cinta" });
  rest.dispatch({ type: "startRest", seconds: 90, label: "Sentadilla" });
  clock.time = 31000;
  cardio.dispatch({ type: "pause" });
  assert.equal(cardio.getSnapshot().timer.status, "paused");
  assert.equal(rest.getSnapshot().timer.status, "running");
  rest.dispatch({ type: "reset" });
  assert.equal(cardio.getSnapshot().timer.status, "paused");
  assert.equal(elapsedTime(cardio.getSnapshot().timer, 31000), 30000);
  // Cada store escribe solo en su disco y con su propio modo.
  assert.equal(JSON.parse(cardioFixture.disk.value).mode, "stopwatch");
  assert.equal(JSON.parse(restFixture.disk.value).mode, "rest");
  assert.equal(JSON.parse(restFixture.disk.value).status, "idle");
});

test("un estado guardado de cuenta atrás o corrupto no se adopta como cronómetro de cardio", () => {
  const countdown = JSON.stringify(transitionTimer(INITIAL_TIMER, { type: "startRest", seconds: 60 }, 1000));
  for (const stored of [countdown, "{no es json", JSON.stringify({ version: 2 }), null]) {
    const store = createTimerStore(runtimeFixture({ value: stored }).runtime, cardioOptions);
    store.subscribe(() => {});
    assert.deepEqual(store.getSnapshot().timer, INITIAL_CARDIO_TIMER);
  }
  assert.deepEqual(restoreTimer("{no es json", 0, INITIAL_CARDIO_TIMER), INITIAL_CARDIO_TIMER);
  assert.deepEqual(restoreTimer(null, 0, INITIAL_CARDIO_TIMER), INITIAL_CARDIO_TIMER);
  assert.deepEqual(restoreTimer(null, 0), INITIAL_TIMER);
});

test("cancelar (reset) deja el cronómetro en reposo y a cero", () => {
  const started = transitionTimer(INITIAL_CARDIO_TIMER, { type: "startStopwatch", label: "Remo" }, 1000);
  const reset = transitionTimer(started, { type: "reset" }, 601000);
  assert.equal(reset.status, "idle");
  assert.equal(elapsedTime(reset, 999999), 0);
  assert.equal(reset.mode, "stopwatch");
});

test("el cronómetro ascendente se detiene en el máximo sin desbordarse", () => {
  const started = transitionTimer(INITIAL_CARDIO_TIMER, { type: "startStopwatch", label: "Bici" }, 0);
  const restored = restoreTimer(JSON.stringify(started), 200 * HOUR, INITIAL_CARDIO_TIMER);
  assert.equal(restored.status, "finished");
  assert.equal(elapsedTime(restored, 300 * HOUR), MAX_ELAPSED_MS);
});

test("la sincronización entre pestañas funciona para el cardio y no reescribe", () => {
  const fixture = runtimeFixture();
  const store = createTimerStore(fixture.runtime, cardioOptions);
  store.subscribe(() => {});
  fixture.disk.value = JSON.stringify(transitionTimer(INITIAL_CARDIO_TIMER, { type: "startStopwatch", label: "Natación" }, 1000));
  fixture.clock.time = 61000;
  fixture.storage();
  assert.equal(store.getSnapshot().timer.label, "Natación");
  assert.equal(elapsedTime(store.getSnapshot().timer, store.getSnapshot().now), 60000);
  assert.equal(fixture.writes(), 0);
});
