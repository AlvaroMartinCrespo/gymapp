# 🏋️‍♂️ GymApp

PWA minimalista de gimnasio (dark mode, Shadcn/Xiaomi) con visor 3D de músculos, cronómetro flotante, recap, rankings y entrenador IA.

## Estado

- [x] **Fase 1** — Diseño base, PWA y navegación
- [ ] Fase 2 — D1, catálogo cerrado y auth
- [ ] Fase 3 — Visor 3D, apuntar ejercicios y cronómetro
- [ ] Fase 4 — Perfil, fatiga, historial, recap y rankings
- [ ] Fase 5 — Entrenador IA (Groq) y feed social

## Desarrollo

```bash
npm install
npm run dev      # genera los iconos PWA y arranca en http://localhost:3000
npm run build
```

Los iconos PWA se generan con `scripts/generate-icons.mjs` (sin dependencias) antes de `dev` y `build`; no se versionan.

## Instalar como app

- **iPhone/iPad:** Safari → Compartir → *Añadir a pantalla de inicio*
- **Android/Desktop:** Chrome → *Instalar aplicación*

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · estilo shadcn/ui · lucide-react · Geist (autoalojada)
