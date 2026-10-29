import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createSeedSql, exercises } from "./seed.mjs";

test("el catálogo contiene 45 ejercicios en las siete categorías del esquema", () => {
  assert.equal(exercises.length, 45);
  const schema = readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8");
  const categoryBlock = schema.match(/export const CATEGORIES = \[([\s\S]*?)\] as const/);
  assert.ok(categoryBlock);
  const categories = [...categoryBlock[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(exercises.map((exercise) => exercise.category))].sort(), categories.sort());
  assert.doesNotThrow(() => createSeedSql());
});

test("rechaza datos incompletos, identificadores repetidos y mallas inconsistentes", () => {
  assert.throws(() => createSeedSql([]));
  assert.throws(() => createSeedSql([exercises[0], exercises[0]]));
  for (const change of [
    { id: "bad-id" }, { name: " " }, { category: "Otra" },
    { defaultCamera: "side" }, { primaryMeshes: [] },
    { secondaryMeshes: ["pectoralis_major"] }, { primaryMeshes: [null] },
  ]) {
    assert.throws(() => createSeedSql([{ ...exercises[0], ...change }]));
  }
});

test("el SQL del catálogo es repetible y conserva referencias en SQLite (no valida PostgreSQL)", () => {
  const migration = readFileSync(new URL("../drizzle/0000_wealthy_the_order.sql", import.meta.url), "utf8");
  const updated = exercises.map((exercise, index) => index === 0
    ? { ...exercise, name: "Press de banca actualizado" }
    : exercise);
  const result = spawnSync("sqlite3", [":memory:"], {
    encoding: "utf8",
    input: `PRAGMA foreign_keys = ON;
${migration}
${createSeedSql()}
INSERT INTO users (id, username, email, password_hash) VALUES ('user', 'tester', 'test@example.com', 'test');
INSERT INTO workout_logs (id, user_id, date) VALUES ('log', 'user', '2026-10-29');
INSERT INTO workout_sets (id, workout_log_id, exercise_id, set_number, weight, reps) VALUES ('set', 'log', 'bench_press', 1, 60, 10);
${createSeedSql(updated)}
SELECT count(*) FROM exercises_catalog;
SELECT name FROM exercises_catalog WHERE id = 'bench_press';
SELECT exercise_id || ':' || weight || ':' || reps FROM workout_sets;
SELECT count(*) FROM pragma_foreign_key_check;
SELECT count(*) FROM exercises_catalog WHERE NOT json_valid(primary_meshes) OR NOT json_valid(secondary_meshes);
`,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split("\n"), [
    "45", "Press de banca actualizado", "bench_press:60.0:10", "0", "0",
  ]);
});

test("el generador escapa apóstrofos en nombres", () => {
  const sql = createSeedSql([{ ...exercises[0], name: "Press d'ejemplo" }]);
  assert.ok(sql.includes("'Press d''ejemplo'"));
});

test("el seed de Supabase coincide con el catálogo fuente", () => {
  const seed = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
  assert.equal(seed, createSeedSql());
});