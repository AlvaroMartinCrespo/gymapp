// Genera los iconos PWA (PNG) sin dependencias externas.
// Se ejecuta automáticamente antes de `dev` y `build` (ver package.json).
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const BG = [9, 9, 11];
const RED = [239, 68, 68];

// Distancia con signo a un rectángulo redondeado (x, y, w, h, r)
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function shapes(size, maskable) {
  const s = size * (maskable ? 0.6 : 0.72);
  const o = (size - s) / 2;
  const cy = size / 2;
  const barH = s * 0.1;
  const list = [[o + s * 0.18, cy - barH / 2, s * 0.64, barH, barH / 2]];
  for (const [x0, x1, h] of [
    [0.0, 0.1, 0.42],
    [0.1, 0.18, 0.6],
    [0.82, 0.9, 0.6],
    [0.9, 1.0, 0.42],
  ]) {
    list.push([o + s * x0, cy - (s * h) / 2, s * (x1 - x0), s * h, s * 0.03]);
  }
  return list;
}

function render(size, maskable) {
  const rects = shapes(size, maskable);
  const SS = 3; // supersampling 3x3 para bordes suaves
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filtro PNG: none
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (rects.some(([rx, ry, rw, rh, rr]) => sdRoundRect(px, py, rx, ry, rw, rh, rr) <= 0)) cover++;
        }
      }
      const a = cover / (SS * SS);
      const i = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[i + c] = Math.round(BG[c] * (1 - a) + RED[c] * a);
    }
  }
  return raw;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, maskable) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(render(size, maskable), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192, false));
writeFileSync("public/icons/icon-512.png", png(512, false));
writeFileSync("public/icons/icon-maskable-512.png", png(512, true));
writeFileSync("public/icons/apple-touch-icon.png", png(180, true));
console.log("✓ Iconos PWA generados en public/icons");
