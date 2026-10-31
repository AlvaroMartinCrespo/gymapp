# Cardio · Fases 0 y 1

## Fase 0 · Verificación (resultado)

**Pregunta:** ¿puede existir un `workout_log` sin series sin romper nada?
**Respuesta:** sí, y de hecho ya ocurre hoy: la app borra series sueltas (`action: "delete"`) pero nunca borra el log, así que al quitar la última serie queda un log vacío.

| Pieza | Comportamiento con un log sin series | ¿Cambio necesario? |
|---|---|---|
| `get_workout_history` | Une con `workout_sets` (inner join): el día no aparece como entrenado | No ahora. **Fase 4:** los días solo de cardio no se marcarán en el calendario hasta ampliar esta función |
| `get_workout_recap` | Igual: ignora el log | No (la tarjeta de cardio se añade en Fase 4) |
| `get_profile_overview`, `get_coach_context` | Inner join con series: ignoran el log | No |
| `get_rankings` | Exige `completed_at` y series | No |
| `finish_workout` / `finish_workout_core` | Lanzan `No workout sets` (22023) | No: un día solo de cardio no se "finaliza" y nada depende de ello |
| `auto_finish_past_workouts` | Filtra logs con series (`exists`) y captura errores | No: deja los logs solo de cardio sin `completed_at` |
| Triggers `reopen_changed_workout` / `invalidate_changed_workout_log` | Solo escuchan `workout_sets` y cambios de fecha/borrado del log | No: añadir cardio a un día finalizado **no** lo reabre |
| `get_workout_session` | `day_set_count = 0` deshabilita "Finalizar" | No |

**Decisiones de diseño derivadas**

- La sesión cuelga de `workout_log_id` y **no tiene columna `date`**: los clientes pueden cambiar `workout_logs.date`, y una segunda fecha se desincronizaría.
- Tampoco lleva `user_id`: el propietario se comprueba a través del log, igual que `workout_sets` (política `sets_owner`).
- Borrar un entrenamiento borra su cardio (`on delete cascade`). Hoy la app no borra logs, pero conviene tenerlo presente.

## Fase 1 · Modelo de datos (hecho)

- `supabase/migrations/20261031000000_cardio_sessions.sql`: tabla `cardio_sessions`, RLS, permisos por columna, restricciones y catálogo cerrado (cinta, correr, caminar, bici estática, elíptica, remo, comba, natación).
- `data_source = 'sensor'` queda reservado al servidor; los clientes solo escriben `manual` o `estimated`. `workout_log_id` no se puede modificar.
- `client_request_id` + índice único para guardados idempotentes (mismo patrón que las series), pensado para el RPC de la Fase 2.
- `src/db/schema.ts`: `CARDIO_ACTIVITIES`, `CARDIO_DATA_SOURCES` y `cardioSessions`.
- Tests: 4 nuevos en `scripts/database.test.mjs` y un bloque de cardio al final de `supabase/tests/rls.sql` (aislamiento entre usuarios, restricciones, que las funciones de fuerza devuelvan lo mismo con y sin cardio, y que un día solo de cardio no se finalice).

### Cómo aplicarlo

```bash
npm run db:push   # supabase db push; aplica 20261031000000_cardio_sessions.sql
```

### Correcciones en tests ya existentes (necesarias para poder ejecutarlos)

En `supabase/tests/rls.sql`:
1. Tres condiciones `if ... <> case when ... then ... end` fallaban con error de sintaxis en PL/pgSQL (el `then` del `case` se confunde con el del `if`). Ahora el `case` va entre paréntesis.
2. Dos comprobaciones esperaban 45 ejercicios; el catálogo tiene 48.

### Verificación realizada

Aplicadas las 11 migraciones en un PostgreSQL 16 local (con stubs de `auth` y de los roles `anon`/`authenticated`, no es un Supabase real) y ejecutado `rls.sql` completo con el propio test del proyecto: 15/15 en `database.test.mjs`. Una mutación deliberada del test de cardio falla como debe. En el resto de la suite solo falla `seed.test.mjs` (necesita `sqlite3`, que no está en este entorno, y ya fallaba antes de los cambios). No he probado contra un proyecto Supabase real.
