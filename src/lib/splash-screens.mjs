// Pantallas de arranque (splash) de iOS: una imagen por tamaño de pantalla, en vertical (la app es `portrait`).
// iOS no las deduce del manifest: elige el <link rel="apple-touch-startup-image"> cuyo `media` coincide
// exactamente con el ancho/alto en puntos y la densidad del dispositivo. Si ninguno coincide, muestra blanco.
// Las usan `scripts/generate-icons.mjs` (genera los PNG) y `src/app/layout.tsx` (los declara).

// width/height en puntos CSS (`device-width` y `device-height`), ratio = densidad de píxeles.
export const SPLASH_SCREENS = [
  { device: "iPhone 16 Pro Max", width: 440, height: 956, ratio: 3 },
  { device: "iPhone 16 Pro", width: 402, height: 874, ratio: 3 },
  { device: "iPhone 16 Plus, 15 Pro Max, 15 Plus, 14 Pro Max", width: 430, height: 932, ratio: 3 },
  { device: "iPhone 16, 15 Pro, 15, 14 Pro", width: 393, height: 852, ratio: 3 },
  { device: "iPhone 14 Plus, 13 Pro Max, 12 Pro Max", width: 428, height: 926, ratio: 3 },
  { device: "iPhone 14, 13 Pro, 13, 12 Pro, 12", width: 390, height: 844, ratio: 3 },
  { device: "iPhone 13 mini, 12 mini, 11 Pro, XS, X", width: 375, height: 812, ratio: 3 },
  { device: "iPhone 11 Pro Max, XS Max", width: 414, height: 896, ratio: 3 },
  { device: "iPhone 11, XR", width: 414, height: 896, ratio: 2 },
  { device: "iPhone 8 Plus, 7 Plus, 6s Plus", width: 414, height: 736, ratio: 3 },
  { device: "iPhone SE (2.ª y 3.ª gen.), 8, 7, 6s", width: 375, height: 667, ratio: 2 },
  { device: "iPhone SE (1.ª gen.), 5s", width: 320, height: 568, ratio: 2 },
  { device: "iPad Pro 13\" (M4)", width: 1032, height: 1376, ratio: 2 },
  { device: "iPad Pro 12,9\"", width: 1024, height: 1366, ratio: 2 },
  { device: "iPad Pro 11\" (M4)", width: 834, height: 1210, ratio: 2 },
  { device: "iPad Pro 11\", Air 10,9\"", width: 834, height: 1194, ratio: 2 },
  { device: "iPad Air 10,5\", Pro 10,5\"", width: 834, height: 1112, ratio: 2 },
  { device: "iPad 10,9\" (10.ª gen.)", width: 820, height: 1180, ratio: 2 },
  { device: "iPad 10,2\"", width: 810, height: 1080, ratio: 2 },
  { device: "iPad mini 8,3\"", width: 744, height: 1133, ratio: 2 },
  { device: "iPad 9,7\", mini 7,9\"", width: 768, height: 1024, ratio: 2 },
];

export const splashFile = ({ width, height, ratio }) => `splash-${width * ratio}x${height * ratio}.png`;
export const splashUrl = (screen) => `/splash/${splashFile(screen)}`;
export const splashMedia = ({ width, height, ratio }) =>
  `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`;
