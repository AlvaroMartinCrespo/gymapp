# Cardio · Fase 3 (cronómetro de cardio)

## Qué hay

- **Cronómetro propio** dentro del formulario de Cardio (bajo la actividad): Iniciar → Pausar / Reanudar → **Terminar** (vuelca la duración al formulario) o **Descartar**.
- **Tienda independiente** (`createTimerStore` con `CARDIO_TIMER_STORAGE_KEY = "gymapp-cardio-timer-v1"`): reutiliza las funciones puras de `timer.ts` pero con otra clave y siempre en modo ascendente, así no interfiere con el cronómetro de fuerza/descanso (`gymapp-timer-v1`). `TimerProvider` mantiene ambas; `useCardioTimer()` da acceso a la de cardio.
- **Píldora propia** (`cardio-timer-pill.tsx`), visible mientras hay un cardio en curso o en pausa. Se coloca debajo de la de descanso si coinciden, y se oculta cuando ya estás viendo la pestaña Cardio. Desde otra página enlaza a `/entrenar#cardio`; desde Entrenar cambia de pestaña. Descartar desde la píldora pide confirmación.
- **Pestaña activa en el hash** (`use-training-tab.ts`): `#cardio` abre Cardio y sobrevive a recargas. Sustituye al estado local de `training-tabs.tsx`.

## Cambios en `timer.ts` (compatibles hacia atrás)

- `createTimerStore(runtime, { initial, accept })`: estado en reposo configurable y filtro para rechazar estados guardados de otro modo (p. ej. una cuenta atrás en la clave de cardio).
- `createBrowserRuntime(storageKey)` (antes la clave estaba fija).
- `restoreTimer(serialized, now, fallback)`: el tercer parámetro es opcional.
- Nueva acción `startStopwatch` (cronómetro ascendente con etiqueta).
- Los 15 tests previos del cronómetro pasan sin cambios.

## Comportamiento y casos límite

| Caso | Qué pasa |
|---|---|
| App en segundo plano, bloqueo o cierre | El tiempo se calcula con marcas de tiempo (`startedAt`), no con ticks: al volver se recupera el tiempo real. |
| Recarga | El estado vive en `localStorage`; se restaura en marcha o en pausa, con su actividad (la etiqueta guarda el nombre de la actividad). |
| Cronómetros de fuerza y cardio a la vez | Independientes (claves y tiendas distintas); las dos píldoras no se solapan. |
| Cancelar sin guardar | **Descartar** (con confirmación) reinicia el cronómetro y no guarda nada. |
| Terminar | Congela el tiempo, rellena minutos y segundos y la actividad. **El cronómetro no se reinicia hasta guardar**, así que si cierras la app antes de guardar la duración no se pierde (vuelves a pulsar Terminar). |
| Guardar | Reinicia el cronómetro solo si la duración venía de él. Si se edita la duración a mano o se pulsa Reanudar, deja de considerarse "del cronómetro" y un guardado manual no lo toca. |
| Más de 24 h | La base de datos admite 24 h como máximo: se limita a 24 h y se avisa. |
| Editar una sesión | Mientras hay cronómetro activo no se puede editar (y viceversa), para no mezclar duraciones. |
| Sin `localStorage` | Sigue funcionando en memoria y se avisa de que se perderá al recargar. |
| Varias pestañas del navegador | Se sincronizan por el evento `storage`. |

## Verificación

- `npm test`: 157 pasan, 1 falla. Nuevos: `scripts/cardio-timer.test.mjs` (9 tests: claves independientes, `startStopwatch`, pausar-cerrar-volver-terminar, cuenta durante el cierre, fuerza y cardio simultáneos, rechazo de estados ajenos o corruptos, reset, tope de 99 h, sincronización entre pestañas). Se comprobó con mutaciones que los tests detectan la ausencia del filtro `accept` y un `startedAt` erróneo. El único fallo es `seed.test.mjs` (necesita `sqlite3`; ya fallaba antes).
- **No verificado:** `next build`, ESLint, tipos completos (no hay `node_modules`; un `tsc` parcial no muestra errores propios) ni el flujo en navegador. En particular, sin probar en un navegador real: la actualización del hash con `history.replaceState` en el router de Next 16 (AGENTS.md avisa de cambios y no había documentación local), la navegación de la píldora desde otras páginas a `#cardio` y el comportamiento con la app en segundo plano en móvil. Si el hash no se leyera al llegar desde otra página, el efecto sería aterrizar en Fuerza con la píldora visible, desde la que se puede pulsar para pasar a Cardio.
