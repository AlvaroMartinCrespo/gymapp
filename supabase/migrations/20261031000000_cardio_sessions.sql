-- Sesiones de cardio (Fase 1 del plan de cardio).
-- Aplicar después de las diez migraciones anteriores.
--
-- Diseño:
--   * Cada sesión cuelga de un workout_log (el del día), igual que workout_sets. Así el calendario
--     sigue marcándose por workout_logs y el propietario se comprueba a través del log (mismo patrón
--     de RLS que sets_owner).
--   * La fecha NO se duplica aquí: vive solo en workout_logs.date. Como los clientes pueden cambiar
--     esa fecha, una segunda copia podría quedar desincronizada.
--   * Un log sin series ya es posible hoy (p. ej. al borrar la última serie). Historial, Recap,
--     Perfil, Coach y Rankings unen siempre con workout_sets, así que ignoran logs solo de cardio.
--     finish_workout y auto_finish_past_workouts exigen series, así que tampoco finalizan días solo
--     de cardio. Ninguna de esas funciones necesita cambios en esta fase.
--   * Catálogo de actividades cerrado mediante CHECK (ampliarlo = nueva migración).
--   * data_source = 'sensor' queda reservado al servidor: los clientes solo pueden escribir
--     'manual' o 'estimated'.
begin;

create table public.cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'treadmill', 'running', 'walking', 'stationary_bike', 'elliptical', 'rowing', 'jump_rope', 'swimming'
  )),
  duration_seconds integer not null check (duration_seconds between 1 and 86400),
  distance_km numeric(7, 3) check (distance_km is null or (distance_km > 0 and distance_km <= 1000)),
  avg_hr smallint check (avg_hr is null or avg_hr between 30 and 250),
  max_hr smallint check (max_hr is null or max_hr between 30 and 250),
  calories integer check (calories is null or calories between 0 and 20000),
  data_source text not null default 'manual' check (data_source in ('manual', 'estimated', 'sensor')),
  rpe smallint check (rpe is null or rpe between 1 and 10),
  client_request_id uuid,
  created_at timestamptz not null default now(),
  check (avg_hr is null or max_hr is null or max_hr >= avg_hr)
);
create index cardio_sessions_log_idx on public.cardio_sessions (workout_log_id);
create unique index cardio_sessions_request_uq on public.cardio_sessions (workout_log_id, client_request_id);

alter table public.cardio_sessions enable row level security;
revoke all on public.cardio_sessions from public, anon, authenticated;

grant select, delete on public.cardio_sessions to authenticated;
grant insert (workout_log_id, activity_type, duration_seconds, distance_km, avg_hr, max_hr, calories, data_source, rpe, client_request_id)
  on public.cardio_sessions to authenticated;
-- workout_log_id no se puede cambiar: una sesión no migra entre días ni entre usuarios.
grant update (activity_type, duration_seconds, distance_km, avg_hr, max_hr, calories, data_source, rpe)
  on public.cardio_sessions to authenticated;

create policy cardio_owner on public.cardio_sessions
  for all to authenticated
  using (exists (
    select 1 from public.workout_logs
    where workout_logs.id = cardio_sessions.workout_log_id and workout_logs.user_id = (select auth.uid())
  ))
  with check (
    data_source in ('manual', 'estimated')
    and exists (
      select 1 from public.workout_logs
      where workout_logs.id = cardio_sessions.workout_log_id and workout_logs.user_id = (select auth.uid())
    )
  );

commit;
