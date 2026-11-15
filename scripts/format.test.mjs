import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDate, formatNumber, formatRelativeDate } from "../src/lib/format.ts";
import { postJson } from "../src/lib/api.ts";

test("formatDate usa mediodía local para que el día no cambie", () => {
  assert.equal(formatDate("2026-11-05", "day"), "5 nov");
  assert.equal(formatDate("2026-11-05"), "5 nov 2026");
  assert.equal(formatDate("2026-11-05", "full"), "5 de noviembre de 2026");
  assert.equal(formatDate("2026-11-05", "monthYear"), "noviembre de 2026");
  assert.equal(formatDate("2026-11-05", "month"), "nov");
});

test("formatDate admite una marca de tiempo ISO", () => {
  assert.equal(formatDate("2026-03-15T10:00:00.000Z", "monthYear"), "marzo de 2026");
});

test("formatRelativeDate muestra Hoy y el año solo si cambia", () => {
  assert.equal(formatRelativeDate("2026-11-15", "2026-11-15"), "Hoy");
  assert.equal(formatRelativeDate("2026-11-05", "2026-11-15"), "5 nov");
  assert.equal(formatRelativeDate("2025-11-05", "2026-11-15"), "5 nov 2025");
  assert.equal(formatRelativeDate("2025-11-05", ""), "5 nov");
});

test("formatNumber respeta decimales, signo y notación compacta", () => {
  assert.equal(formatNumber(1234.567), "1234,57");
  assert.equal(formatNumber("62.5"), "62,5");
  assert.equal(formatNumber(1.23456, { decimals: 3 }), "1,235");
  assert.equal(formatNumber(3, { signed: true }), "+3");
  assert.equal(formatNumber(-2, { signed: true }), "-2");
  assert.equal(formatNumber(0, { signed: true }), "0");
  assert.match(formatNumber(123456, { compact: true }), /123,5|mil/);
});

test("postJson devuelve datos, error del servidor o 'sin respuesta' sin lanzar nunca", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const respond = (status, body) => { globalThis.fetch = async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }); };

  respond(200, { a: 1 });
  assert.deepEqual(await postJson("/x", {}), { ok: true, status: 200, data: { a: 1 } });
  respond(401, { error: "No autorizado" });
  assert.deepEqual(await postJson("/x", {}), { ok: false, status: 401, error: "No autorizado", unreachable: false });
  respond(500, {});
  assert.deepEqual(await postJson("/x", {}), { ok: false, status: 500, error: null, unreachable: false });
  respond(502, "<html>Bad gateway</html>");
  assert.deepEqual(await postJson("/x", {}), { ok: false, status: 0, error: null, unreachable: true });
  globalThis.fetch = async () => { throw new TypeError("network"); };
  assert.equal((await postJson("/x", {})).unreachable, true);
});
