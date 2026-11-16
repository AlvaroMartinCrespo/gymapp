/**
 * Vuelca la geometría del GLB en espacio mundo (posiciones, normales, índices y si la malla es un
 * músculo del catálogo) para que `render-poster.py` la rasterice. Mismas dependencias que
 * `optimize-model.mjs`. Uso: node dump-geometry.mjs <modelo.glb> <prefijo-de-salida>
 */
import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { writeFileSync } from "node:fs";
import { muscleForName } from "../../public/anatomy/muscles.mjs";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const P = [], N = [], I = [], G = []; let base = 0;
const muscle = muscleForName;
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const m = node.getWorldMatrix(), prim = mesh.listPrimitives()[0];
  const A = prim.getAttribute("POSITION"), B = prim.getAttribute("NORMAL"), idx = prim.getIndices();
  const v = [0,0,0], isM = muscle(node.getName()) ? 1 : 0;
  for (let k = 0; k < A.getCount(); k++) {
    A.getElement(k, v); for (let c = 0; c < 3; c++) P.push(m[c]*v[0]+m[4+c]*v[1]+m[8+c]*v[2]+m[12+c]);
    B.getElement(k, v); const n = [0,1,2].map(c => m[c]*v[0]+m[4+c]*v[1]+m[8+c]*v[2]); const l = Math.hypot(...n) || 1; N.push(n[0]/l, n[1]/l, n[2]/l);
    G.push(isM);
  }
  const ia = idx.getArray(); for (let k = 0; k < ia.length; k++) I.push(ia[k] + base);
  base += A.getCount();
}
const out = process.argv[3];
writeFileSync(out + ".p", Buffer.from(new Float32Array(P).buffer)); writeFileSync(out + ".n", Buffer.from(new Float32Array(N).buffer));
writeFileSync(out + ".i", Buffer.from(new Uint32Array(I).buffer)); writeFileSync(out + ".g", Buffer.from(new Uint8Array(G).buffer));
console.log(out, "vértices", base, "triángulos", I.length / 3);
