import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { muscleForName, muscleGroups, muscleAppearance, validMuscles, validHeat } from "../public/anatomy/muscles.mjs";
import { MeshoptDecoder } from "../public/vendor/meshoptimizer/meshopt_decoder.module.js";
import { createProfileHandler } from "../src/lib/supabase/profile.mjs";
import { getRecapRange } from "../src/lib/recap.mjs";

const binary = await readFile(new URL("../public/models/human_muscles.glb", import.meta.url));
const document = JSON.parse(binary.toString("utf8", 20, 20 + binary.readUInt32LE(12)));
const catalog = JSON.parse(await readFile(new URL("../src/db/exercises.json", import.meta.url), "utf8"));

test("el GLB real tiene cabecera, versión, licencia y mallas independientes válidas", () => {
  assert.equal(binary.toString("ascii", 0, 4), "glTF");
  assert.equal(binary.readUInt32LE(4), 2);
  assert.equal(binary.readUInt32LE(8), binary.length);
  assert.equal(binary.readUInt32LE(16), 0x4e4f534a);
  assert.match(document.asset.copyright, /CC BY-SA 4\.0/);
  assert.ok(document.meshes.length > 100);
  assert.ok(document.extensionsRequired.includes("EXT_meshopt_compression"));
});

test("todos los músculos de los 48 ejercicios existen en el modelo real", () => {
  const mapped = new Set(document.meshes.map((mesh) => muscleForName(mesh.name)).filter(Boolean));
  assert.equal(catalog.length, 48);
  for (const exercise of catalog) {
    for (const id of [...exercise.primaryMeshes, ...exercise.secondaryMeshes]) {
      assert.ok(Object.hasOwn(muscleGroups, id), `${exercise.id}: ${id} desconocido`);
      assert.ok(mapped.has(id), `${exercise.id}: ${id} sin mallas`);
    }
  }
  assert.deepEqual([...mapped].sort(), Object.keys(muscleGroups).sort());
});

test("las tres porciones del deltoides se distinguen en ambos lados", () => {
  for (const side of ["left", "right"]) {
    assert.equal(muscleForName(`Clavicular part of ${side} deltoid`), "anterior_deltoid");
    assert.equal(muscleForName(`Acromial part of ${side} deltoid`), "lateral_deltoid");
    assert.equal(muscleForName(`Spinal part of ${side} deltoid`), "posterior_deltoid");
  }
  assert.equal(muscleForName("Sternocostal_part_of_right_pectoralis_major"), "pectoralis_major");
});

test("huesos y músculos de los pies no se confunden con trapecios o antebrazos", () => {
  for (const name of ["Left trapezium", "Left trapezoid", "Left extensor digitorum longus", "Left flexor digitorum brevis", "Atlas", "Linea alba"]) {
    assert.equal(muscleForName(name), null, name);
  }
  assert.equal(muscleForName("Left flexor digitorum superficialis"), "forearms");
});

test("el decodificador local descomprime todos los bufferViews Meshopt del GLB", async () => {
  await MeshoptDecoder.ready;
  const offset = 20 + binary.readUInt32LE(12);
  assert.equal(binary.readUInt32LE(offset + 4), 0x004e4942);
  const buffer = binary.subarray(offset + 8);
  let decoded = 0;
  for (const view of document.bufferViews) {
    const extension = view.extensions?.EXT_meshopt_compression;
    if (!extension) continue;
    assert.equal(extension.buffer, 0);
    const source = buffer.subarray(extension.byteOffset ?? 0, (extension.byteOffset ?? 0) + extension.byteLength);
    const output = await MeshoptDecoder.decodeGltfBufferAsync(extension.count, extension.byteStride, source, extension.mode, extension.filter);
    assert.equal(output.length, extension.count * extension.byteStride);
    decoded++;
  }
  assert.ok(decoded > 0);
});

test("principales tienen prioridad sobre secundarios y desconocidos quedan inactivos", () => {
  const state = { primary: ["rectus_abdominis"], secondary: ["rectus_abdominis", "obliques"] };
  assert.equal(muscleAppearance("rectus_abdominis", state).color, "#ef4444");
  assert.equal(muscleAppearance("obliques", state).color, "#991b1b");
  assert.equal(muscleAppearance("quadriceps", state).active, false);
  assert.deepEqual(validMuscles(["rectus_abdominis", "rectus_abdominis", "unknown", null]), ["rectus_abdominis"]);
  assert.deepEqual(validMuscles(null), []);
});

test("el calor usa series principales reales, separa secundarias y maneja ceros", () => {
  const state = { mode: "heat", heat: [
    { mesh: "rectus_abdominis", primary_sets: 8, secondary_sets: 2 },
    { mesh: "obliques", primary_sets: 2, secondary_sets: 10 },
    { mesh: "quadriceps", primary_sets: 0, secondary_sets: 3 },
  ] };
  assert.ok(muscleAppearance("rectus_abdominis", state).intensity > muscleAppearance("obliques", state).intensity);
  assert.equal(muscleAppearance("quadriceps", state).color, "#991b1b");
  assert.equal(muscleAppearance("biceps", state).active, false);
  assert.equal(muscleAppearance("rectus_abdominis", { mode: "heat", heat: [] }).active, false);
});

test("el calor rechaza valores negativos, fracciones, desbordamientos y grupos desconocidos", () => {
  const valid = { mesh: "rectus_abdominis", primary_sets: 0, secondary_sets: 2 };
  assert.deepEqual(validHeat([valid]), [valid]);
  assert.deepEqual(validHeat([null, { ...valid, mesh: "unknown" }, { ...valid, primary_sets: -1 }, { ...valid, secondary_sets: 0.5 }, { ...valid, primary_sets: Infinity }, { ...valid, primary_sets: "2" }]), []);
  assert.deepEqual(validHeat(undefined), []);
});

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };
const user = { id: "00000000-0000-4000-8000-000000000001", email: "tester@example.test" };
const recap = { profile: { id: user.id }, date: "2026-10-29", period: "week", range: getRecapRange("2026-10-29", "week"), current: { days: 0, sets: 0, exercises: 0, volume: 0 }, previous: { days: 0, sets: 0, exercises: 0, volume: 0 }, buckets: [], categories: [] };
function request() {
  return new Request("https://gymapp.test/api/profile", { method: "POST", headers: { origin: "https://gymapp.test", "content-type": "application/json", cookie: "gymapp-access=current" }, body: JSON.stringify({ action: "recap", date: recap.date, period: recap.period }) });
}
const handlerFor = (result) => createProfileHandler({ env, fetcher: async (url) => Response.json(url.pathname === "/auth/v1/user" ? user : result) });

test("el endpoint acepta músculos reales y sigue compatible antes de aplicar la migración", async () => {
  for (const data of [recap, { ...recap, muscles: [] }, { ...recap, muscles: [{ mesh: "rectus_abdominis", primary_sets: 3, secondary_sets: 1 }] }]) {
    const response = await handlerFor(data)(request());
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).muscles, data.muscles);
  }
});

test("el endpoint rechaza mapas musculares malformados y grupos duplicados", async () => {
  const row = { mesh: "rectus_abdominis", primary_sets: 3, secondary_sets: 1 };
  for (const muscles of [null, {}, [null], [{ ...row, primary_sets: -1 }], [{ ...row, mesh: "unknown" }], [row, row]]) {
    const response = await handlerFor({ ...recap, muscles })(request());
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /primary_sets|rectus_abdominis/);
  }
});

test("la migración muscular mantiene RLS, propietario y conteos distintos sin multiplicar series", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261029080000_muscle_recap.sql", import.meta.url), "utf8");
  assert.match(sql, /security invoker/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /logs\.user_id = auth\.uid\(\)/);
  assert.match(sql, /count\(distinct id\) filter \(where is_primary\)/);
  assert.match(sql, /where not \(current_sets\.primary_meshes \? muscle\.mesh\)/);
  assert.match(sql, /revoke all .* from public, anon/);
  assert.match(sql, /grant execute .* to authenticated/);
});

test("el runtime es autocontenido, verifica emisor y dispone recursos WebGL", async () => {
  const runtime = await readFile(new URL("../public/anatomy/viewer.mjs", import.meta.url), "utf8");
  const host = await readFile(new URL("../src/components/anatomy/muscle-viewer-3d.tsx", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/anatomy/viewer.html", import.meta.url), "utf8");
  assert.match(html, /"three":"\/vendor\/three\/three\.module\.min\.js"/);
  assert.doesNotMatch(runtime, /https:\/\/|https?:\/\/cdn/);
  assert.match(runtime, /event\.source !== parent/);
  assert.match(runtime, /event\.origin !== location\.origin/);
  assert.match(host, /event\.source !== frame\.current\?\.contentWindow/);
  assert.match(runtime, /controls\.enableZoom = false/);
  assert.match(runtime, /controls\.enablePan = false/);
  assert.match(runtime, /camera\.position\.setFromSpherical/);
  assert.doesNotMatch(runtime, /camera\.position\.lerpVectors/);
  assert.match(runtime, /renderer\?\.dispose\(\)/);
  assert.match(runtime, /resource\.dispose\(\)/);
});