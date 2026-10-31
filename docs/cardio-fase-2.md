# Cardio · Fase 2 (registro manual)

## Qué hay

- **Pestañas Fuerza | Cardio en `/entrenar`** (`training-tabs.tsx`). Fuerza sigue montada al cambiar de pestaña (no pierde lo escrito ni recarga); Cardio se monta la primera vez que se abre. Navegación por teclado: flechas, Inicio y Fin.
- **Formulario de cardio** (`cardio-panel.tsx`): actividad (catálogo cerrado), minutos y segundos, distancia, RPE, FC media y máxima, calorías. Solo registra el día de hoy, igual que Fuerza.
- **Lista de sesiones recientes** (últimas 30) con editar y borrar.
- **API `/api/cardio`** (`src/lib/supabase/cardio.mjs`): acciones `list`, `save`, `update` y `delete`. Misma verificación de origen, sesión y JWT que `/api/workouts`; errores de base de datos sin filtrar.
- **Migración `20261031010000_cardio_operations.sql`**: `save_cardio_session` (obtiene o crea el `workout_log` del día y cuelga la sesión; idempotente por `client_request_id`) y `get_recent_cardio` (sesiones con su fecha). Ambas `security invoker`, sin acceso anónimo. Editar y borrar usan PATCH/DELETE sobre `cardio_sessions` con los permisos por columna de la Fase 1.
- **`src/lib/cardio.mjs`**: catálogo con etiquetas, validación, estimación de calorías y formato de duración, compartidos por servidor y formulario.

## Calorías estimadas

Si el usuario no escribe calorías, el **servidor** las estima y guarda `data_source = 'estimated'`; si las escribe, `'manual'`. El cliente nunca envía `data_source`, así `sensor` sigue reservado al servidor.

Fórmula: `MET × peso (kg) × horas`. Para correr, caminar y cinta con distancia, el MET se interpola según la velocidad media (valores del Compendium of Physical Activities); sin distancia o en otras actividades se usa un MET medio por actividad.

**Limitación:** la app todavía no guarda el peso corporal, así que se usa **70 kg** fijos (`DEFAULT_BODY_WEIGHT_KG`). El formulario lo dice y la sesión queda marcada como estimación (en la lista aparece con "≈"). Al editar una sesión estimada, el campo de calorías se deja vacío para que se recalcule si cambian duración o distancia.

## Guardado y reintentos

Igual que las series: cada guardado lleva un UUID; si la respuesta se pierde, se bloquea el formulario y el botón pasa a "Reintentar guardado" con los mismos datos, sin duplicar. Editar y borrar no necesitan UUID porque son idempotentes.

## Cambios en código existente

- `training-panel.tsx`: ya no pinta el título ni la fecha (los pinta `training-tabs.tsx`); el botón de actualizar series pasó a la cabecera de "Series de hoy"; el hook de fecha local se extrajo a `use-local-date.ts`. El resto no cambia.
- `entrenar/page.tsx` renderiza `TrainingTabs`.
- `schema.ts` y las migraciones de la Fase 1 no se tocan.

## Criterio de salida: estado

| Criterio | Estado |
|---|---|
| Registrar, editar y borrar cardio | Hecho |
| El día aparece marcado en el calendario | **No cumplido a propósito**: ver abajo |

**Calendario.** La Fase 0 decidió que `get_workout_history` no cuenta los días solo de cardio hasta la Fase 4, y `rls.sql` tiene un test que exige que el historial no cambie con cardio. Para marcar el día habría que ampliar esa función (y su test) y el panel de Historial, que es trabajo de la Fase 4. No se ha hecho aquí para no contradecir esa decisión sin poder ejecutar SQL.

## Verificación

- `npm test`: 148/150. Nuevos: `scripts/cardio.test.mjs` (14: estimación, validación, handler con fetch simulado) y 3 estáticos de la migración en `database.test.mjs`. El único fallo es `seed.test.mjs`, que necesita `sqlite3` y ya fallaba antes.
- **No ejecutado:** la migración y el bloque nuevo de `supabase/tests/rls.sql` (no había PostgreSQL en el entorno), `next build`, ESLint, la comprobación completa de tipos (no hay `node_modules`) y el flujo en navegador. Un `tsc` parcial no mostró errores en `src/lib/cardio.mjs` ni en `src/lib/supabase/cardio.mjs`; los de los `.tsx` quedan enmascarados por la falta de tipos de React.

### Cómo aplicarlo

```bash
npm install
npm run db:push   # aplica 20261031010000_cardio_operations.sql
npm run lint && npx tsc --noEmit && npm test
```
