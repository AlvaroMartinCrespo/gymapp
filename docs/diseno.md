# Guía de diseño

Reglas que fija el punto 13 de `mejoras.md`. Los tokens viven en `src/app/globals.css`.

## Radios

| Elemento | Clase |
| --- | --- |
| Tarjetas, diálogos, menús | `rounded-2xl` |
| Controles (botones, campos, selects, pestañas, avisos) | `rounded-xl` |
| Chips, insignias, avatares, barras de progreso | `rounded-full` |

Un elemento dentro de un control con relleno (`TabsTrigger` dentro de `TabsList`) usa un escalón menos (`rounded-lg`).

## Colores

Solo variables del tema. Podio de Rankings: `text-gold`, `text-silver`, `text-bronze`. Estados: `success`, `warning`, `error`, `info`. Nada de `amber-*`, `zinc-*`, `rose-*` ni `accent-red-*` sueltos.

## Elevación

| Nivel | Uso | Cómo |
| --- | --- | --- |
| 0 | Fondo de la página | `bg-background` |
| 1 | Tarjeta | `<Card>` o la clase `surface-1` |
| 2 | Lo que flota: menú de cuenta, diálogos, avisos, tooltip, barra fija de Rankings | `<Card elevation={2}>` o `surface-2` |

Agrupa con `Card` en lugar de `border-y` o líneas divisorias de bloque. Dentro de una tarjeta, un bloque secundario usa `rounded-xl border border-border` (o `bg-muted/40`).

## Escala tipográfica

| Clase | Nivel |
| --- | --- |
| `type-page` | Título de la pantalla (`h1`) |
| `type-section` | Título de sección (`h2`) |
| `type-card` | Título dentro de una tarjeta |
| `type-data` | Dato en listas y tablas (mono, cifras tabulares) |
| `type-kpi` / `type-kpi-lg` | Cifras destacadas |
| `type-label` | Etiquetas y texto de apoyo |

`Stat` ya aplica `type-label` y `type-kpi`. Para una variación frente al periodo anterior, pásale `trend={{ current, previous }}`.

## Iconos

Tamaños 16, 20 y 24 px: `size-4` (en texto y botones), `size-5` (cabeceras de sección y navegación) y `size-6` (estados vacíos y avatares). El trazo es `--icon-stroke` (2) para todos los iconos de lucide.

## Movimiento

Easing `--ease-standard`. Duraciones: rápida `duration-150`, base 200 ms (por defecto en cualquier `transition-*`) y lenta `duration-300`. Con `prefers-reduced-motion` se anulan las animaciones y transiciones, salvo los indicadores de carga (`animate-spin`).
