import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { SPLASH_SCREENS, splashFile, splashMedia, splashUrl } from "../src/lib/splash-screens.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const pngSize = (file) => {
  const data = readFileSync(file);
  assert.equal(data.toString("ascii", 1, 4), "PNG", `${file} no es un PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
};

test("la lista de splash de iOS no repite pantallas y todas son verticales", () => {
  const keys = SPLASH_SCREENS.map((screen) => splashMedia(screen));
  assert.equal(new Set(keys).size, keys.length);
  const files = SPLASH_SCREENS.map(splashFile);
  assert.equal(new Set(files).size, files.length, "dos pantallas distintas generarían el mismo fichero");
  for (const screen of SPLASH_SCREENS) {
    assert.ok(screen.height > screen.width, `${screen.device} no es vertical`);
    assert.match(splashMedia(screen), /^\(device-width: \d+px\) and \(device-height: \d+px\) and \(-webkit-device-pixel-ratio: [23]\) and \(orientation: portrait\)$/);
    assert.equal(splashUrl(screen), `/splash/${splashFile(screen)}`);
  }
});

test("npm run icons genera cada splash con las dimensiones en píxeles que pide su media query", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gymapp-splash-"));
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/generate-icons.mjs")], { cwd: dir, stdio: "pipe" });
    for (const screen of SPLASH_SCREENS) {
      const file = path.join(dir, "public/splash", splashFile(screen));
      assert.ok(existsSync(file), `falta ${splashFile(screen)}`);
      assert.deepEqual(pngSize(file), { width: screen.width * screen.ratio, height: screen.height * screen.ratio });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("el layout declara las splash y mantiene el color de la barra de estado igual que el fondo", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /startupImage: SPLASH_SCREENS\.map\(\(screen\) => \(\{ url: splashUrl\(screen\), media: splashMedia\(screen\) \}\)\)/);
  assert.match(layout, /statusBarStyle: "black-translucent"/);
  const background = /--background: (#[0-9a-f]{6})/i.exec(read("src/app/globals.css"))?.[1].toLowerCase();
  assert.equal(background, "#09090b");
  assert.match(layout, new RegExp(`themeColor: "${background}"`, "i"));
  const manifest = read("src/app/manifest.ts");
  assert.match(manifest, new RegExp(`background_color: "${background}"`, "i"));
  assert.match(manifest, new RegExp(`theme_color: "${background}"`, "i"));
  assert.match(read("scripts/generate-icons.mjs"), /const BG = \[9, 9, 11\]/);
  assert.match(read(".gitignore"), /\/public\/splash\/\*\.png/);
});

test("el manifest tiene categorías, accesos directos a páginas que existen y capturas con su tamaño real", () => {
  const manifest = read("src/app/manifest.ts");
  assert.match(manifest, /categories: \["health", "fitness"\]/);

  const shortcuts = [...manifest.matchAll(/name: "([^"]+)",\s*short_name: "[^"]+",\s*description: "[^"]+",\s*url: "([^"]+)"/g)].map(([, name, url]) => ({ name, url }));
  assert.deepEqual(shortcuts, [{ name: "Entrenar", url: "/entrenar" }, { name: "Cronómetro", url: "/cronometro" }]);
  for (const { url } of shortcuts) assert.ok(existsSync(path.join(root, "src/app", url, "page.tsx")), `no existe la página ${url}`);

  const screenshots = [...manifest.matchAll(/src: "(\/screenshots\/[^"]+)", sizes: "(\d+)x(\d+)", type: "image\/png", form_factor: "(narrow|wide)", label: "([^"]+)"/g)];
  assert.ok(screenshots.some((match) => match[4] === "narrow") && screenshots.some((match) => match[4] === "wide"), "hacen falta capturas narrow y wide");
  for (const [, src, width, height, formFactor] of screenshots) {
    const size = pngSize(path.join(root, "public", src));
    assert.deepEqual(size, { width: Number(width), height: Number(height) }, `${src} no mide lo que declara el manifest`);
    assert.equal(size.height > size.width, formFactor === "narrow");
    assert.ok(size.width / size.height <= 2.3 && size.height / size.width <= 2.3, `${src} supera la proporción máxima que admite Chrome`);
  }
});
