import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import { SPLASH_SCREENS, splashMedia, splashUrl } from "@/lib/splash-screens.mjs";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GymRat", template: "%s · GymRat" },
  description: "Registra tus entrenos, visualiza tus músculos en 3D y progresa con IA.",
  applicationName: "GymRat",
  appleWebApp: {
    capable: true,
    title: "GymRat",
    // El contenido llega hasta arriba (viewportFit "cover") y el fondo es el mismo #09090b que `theme_color`,
    // `background_color` del manifest y las splash, así que la barra translúcida con texto claro no desentona.
    statusBarStyle: "black-translucent",
    // iOS solo muestra la splash cuyo `media` coincide exactamente con la pantalla; se generan en `npm run icons`.
    startupImage: SPLASH_SCREENS.map((screen) => ({ url: splashUrl(screen), media: splashMedia(screen) })),
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable} dark min-h-dvh antialiased`}
    >
      <body className="min-h-dvh">
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
