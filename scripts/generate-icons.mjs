// Genera los iconos PWA (PNG) sin dependencias externas.
// Se ejecuta automáticamente antes de `dev` y `build` (ver package.json).
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const BG = [9, 9, 11];

// Distancia con signo a un rectángulo redondeado (x, y, w, h, r)
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function shapes(size, maskable) {
  const scale = size * (maskable ? 0.76 : 0.96);
  const offset = (size - scale) / 2;
  const fur = [174, 180, 191];
  const pink = [239, 112, 132];
  const light = [235, 238, 242];
  const ellipse = (centerX, centerY, radiusX, radiusY, color) => ({
    color,
    contains: (pixelX, pixelY) => ((pixelX - offset) / scale - centerX) ** 2 / radiusX ** 2 + ((pixelY - offset) / scale - centerY) ** 2 / radiusY ** 2 <= 1,
  });
  const rectangle = (left, top, width, height, radius, color) => ({
    color,
    contains: (pixelX, pixelY) => sdRoundRect((pixelX - offset) / scale, (pixelY - offset) / scale, left, top, width, height, radius) <= 0,
  });
  return [
    ellipse(0.5, 0.5, 0.49, 0.49, [239, 68, 68]),
    ellipse(0.26, 0.3, 0.16, 0.18, BG),
    ellipse(0.74, 0.3, 0.16, 0.18, BG),
    ellipse(0.26, 0.3, 0.14, 0.16, fur),
    ellipse(0.74, 0.3, 0.14, 0.16, fur),
    ellipse(0.26, 0.3, 0.09, 0.11, pink),
    ellipse(0.74, 0.3, 0.09, 0.11, pink),
    ellipse(0.5, 0.55, 0.27, 0.32, BG),
    ellipse(0.5, 0.54, 0.25, 0.3, fur),
    ellipse(0.4, 0.5, 0.038, 0.052, BG),
    ellipse(0.6, 0.5, 0.038, 0.052, BG),
    ellipse(0.39, 0.48, 0.012, 0.015, light),
    ellipse(0.59, 0.48, 0.012, 0.015, light),
    ellipse(0.5, 0.7, 0.16, 0.12, light),
    ellipse(0.5, 0.73, 0.072, 0.045, BG),
    rectangle(0.458, 0.73, 0.038, 0.065, 0.007, [255, 255, 255]),
    rectangle(0.504, 0.73, 0.038, 0.065, 0.007, [255, 255, 255]),
    ellipse(0.5, 0.65, 0.057, 0.038, BG),
    ellipse(0.49, 0.642, 0.018, 0.009, pink),
    rectangle(0.21, 0.65, 0.18, 0.014, 0.007, BG),
    rectangle(0.19, 0.7, 0.2, 0.014, 0.007, BG),
    rectangle(0.61, 0.65, 0.18, 0.014, 0.007, BG),
    rectangle(0.61, 0.7, 0.2, 0.014, 0.007, BG),
  ];
}

function render(size, maskable) {
  const layers = shapes(size, maskable);
  const SS = 3; // supersampling 3x3 para bordes suaves
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filtro PNG: none
    for (let x = 0; x < size; x++) {
      const channels = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          let color = BG;
          for (const layer of layers) {
            if (layer.contains(px, py)) color = layer.color;
          }
          for (let channel = 0; channel < 3; channel++) channels[channel] += color[channel];
        }
      }
      const i = y * (size * 3 + 1) + 1 + x * 3;
      for (let channel = 0; channel < 3; channel++) raw[i + channel] = Math.round(channels[channel] / (SS * SS));
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
