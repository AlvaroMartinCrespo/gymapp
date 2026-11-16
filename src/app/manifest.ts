import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GymRat",
    short_name: "GymRat",
    description: "Registra tus entrenos, visualiza tus músculos en 3D y progresa con IA.",
    lang: "es",
    categories: ["health", "fitness"],
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Accesos directos al mantener pulsado el icono (Android/Chrome y escritorio). Los iconos son los PNG de la app.
    shortcuts: [
      {
        name: "Entrenar",
        short_name: "Entrenar",
        description: "Registrar una serie de tu entrenamiento",
        url: "/entrenar",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Cronómetro",
        short_name: "Cronómetro",
        description: "Controlar el descanso entre series",
        url: "/cronometro",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    // Ilustraciones de `scripts/screenshots/render-screenshots.py`; hay que mantener nombres y tamaños si se sustituyen por capturas reales.
    screenshots: [
      { src: "/screenshots/narrow-entrenar.png", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Registrar una serie en Entrenar" },
      { src: "/screenshots/narrow-anatomia.png", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "Músculos trabajados en 3D" },
      { src: "/screenshots/wide-recap.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Recap semanal en escritorio" },
    ],
  };
}
