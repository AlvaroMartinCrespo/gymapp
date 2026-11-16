#!/usr/bin/env node
/**
 * Reduce el peso de `human_muscles.glb` sin cambiar nada de lo que usa el visor:
 *  - quita `COLOR_0` (colores de vértice): el visor sustituye los materiales y nunca los lee;
 *  - simplifica las mallas (meshoptimizer) con un error máximo pequeño y bordes bloqueados;
 *  - recodifica con EXT_meshopt_compression (posiciones de 16 bits, normales de 10).
 * Los nombres de nodos y mallas, la jerarquía y los metadatos de licencia se conservan.
 *
 * No forma parte de `npm test` ni del build. Las dependencias son solo de este script:
 *   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
 *   node scripts/model/optimize-model.mjs original.glb public/models/human_muscles.glb [--ratio=0.5] [--error=0.002]
 *
 * Parte siempre del GLB original (está en el historial de git), no de uno ya optimizado:
 * cada pasada simplifica de nuevo.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt, simplify, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const [input, output] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const option = (name, fallback) => {
  const found = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return found ? Number(found.slice(name.length + 3)) : fallback;
};
if (!input || !output) {
  console.error("Uso: node optimize-model.mjs <entrada.glb> <salida.glb> [--ratio=0.5] [--error=0.002]");
  process.exit(1);
}
const ratio = option("ratio", 0.5);
const error = option("error", 0.002);

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

function glbJson(buffer) {
  return JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)));
}

const source = readFileSync(input);
const originalGenerator = glbJson(source).asset?.generator ?? "";
const doc = await io.read(input);
const root = doc.getRoot();
const triangles = () => root.listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n, prim) => n + prim.getIndices().getCount() / 3, 0), 0);
const before = triangles();

// quantize() de glTF-Transform no admite posiciones ya enteras (las deja a cero): se parte de Float32 reales.
const toFloat = (accessor) => {
  const out = new Float32Array(accessor.getCount() * 3);
  const value = [0, 0, 0];
  for (let i = 0; i < accessor.getCount(); i++) {
    accessor.getElement(i, value);
    out.set(value, i * 3);
  }
  accessor.setArray(out).setNormalized(false);
};
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    prim.setAttribute("COLOR_0", null);
    toFloat(prim.getAttribute("POSITION"));
    toFloat(prim.getAttribute("NORMAL"));
  }
}

await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: true }),
  meshopt({ encoder: MeshoptEncoder, level: "high", quantizePosition: 16, quantizeNormal: 10 }),
);

// glTF-Transform sobrescribe `asset.generator`; se restaura el original y se añade la nota de modificación.
const note = "optimized with glTF-Transform + meshoptimizer";
const generator = originalGenerator.includes(note) ? originalGenerator : `${originalGenerator}${originalGenerator ? "; " : ""}${note}`;
const glb = Buffer.from(await io.writeBinary(doc));
const json = glbJson(glb);
json.asset.generator = generator;
let text = JSON.stringify(json);
while (Buffer.byteLength(text) % 4) text += " ";
const jsonChunk = Buffer.from(text);
const rest = glb.subarray(20 + glb.readUInt32LE(12));
const header = Buffer.alloc(20);
header.write("glTF", 0, "ascii");
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + jsonChunk.length + rest.length, 8);
header.writeUInt32LE(jsonChunk.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
writeFileSync(output, Buffer.concat([header, jsonChunk, rest]));

const after = triangles();
console.log(`triángulos: ${before} → ${after} (${Math.round((after / before) * 100)} %)`);
console.log(`tamaño: ${(statSync(input).size / 1e6).toFixed(2)} MB → ${(statSync(output).size / 1e6).toFixed(2)} MB`);
console.log(`generator: ${generator}`);
