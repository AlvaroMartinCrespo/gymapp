-- Operaciones de cardio (Fase 2 del plan de cardio).
-- Aplicar después de 20261031000000_cardio_sessions.sql.
--
--   * save_cardio_session: obtiene o crea el workout_log del día y cuelga de él la sesión.
--     Es idempotente por (workout_log_id, client_request_id), igual que save_workout_set.
--   * get_recent_cardio: sesiones recientes del usuario con su fecha (que vive en workout_logs).
--
-- Ambas son security invoker: la RLS de workout_logs y cardio_sessions sigue mandando.
-- Editar y borrar no necesitan RPC: la API usa PATCH/DELETE sobre cardio_sessions con los
-- permisos por columna y la política cardio_owner de la migración anterior.
begin;

create function public.save_cardio_session(
  p_date date,
  p_activity_type text,
  p_duration_seconds integer,
  p_distance_km numeric,
  p_avg_hr integer,
  p_max_hr integer,
  p_calories integer,
  p_data_source text,
  p_rpe integer,
  p_request_id uuid
)
returns public.cardio_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  day_log_id uuid;
  saved_session public.cardio_sessions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_date is null or p_date < '2000-01-01'::date or p_date > '2100-12-31'::date
    or p_request_id is null
    or p_activity_type is null or p_activity_type not in (
      'treadmill', 'running', 'walking', 'stationary_bike', 'elliptical', 'rowing', 'jump_rope', 'swimming'
    )
    or p_duration_seconds is null or p_duration_seconds not between 1 and 86400
    or (p_distance_km is not null and (p_distance_km <= 0 or p_distance_km > 1000 or p_distance_km <> round(p_distance_km, 3)))
    or (p_avg_hr is not null and p_avg_hr not between 30 and 250)
    or (p_max_hr is not null and p_max_hr not between 30 and 250)
    or (p_avg_hr is not null and p_max_hr is not null and p_max_hr < p_avg_hr)
    or (p_calories is not null and p_calories not between 0 and 20000)
    or p_data_source is null or p_data_source not in ('manual', 'estimated')
    or (p_data_source = 'estimated' and p_calories is null)
    or (p_rpe is not null and p_rpe not between 1 and 10) then
    raise exception 'Invalid cardio data' using errcode = '22023';
  end if;

  insert into public.workout_logs (user_id, date)
  values (auth.uid(), p_date)
  on conflict (user_id, date) do update set date = excluded.date
  returning id into day_log_id;

  select * into saved_session from public.cardio_sessions
  where workout_log_id = day_log_id and client_request_id = p_request_id;
  if found then
    if saved_session.activity_type <> p_activity_type
      or saved_session.duration_seconds <> p_duration_seconds
      or saved_session.distance_km is distinct from p_distance_km
      or saved_session.avg_hr is distinct from p_avg_hr
      or saved_session.max_hr is distinct from p_max_hr
      or saved_session.calories is distinct from p_calories
      or saved_session.data_source <> p_data_source
      or saved_session.rpe is distinct from p_rpe then
      raise exception 'Request already used with different data' using errcode = '22023';
    end if;
    return saved_session;
  end if;

  insert into public.cardio_sessions (
    workout_log_id, activity_type, duration_seconds, distance_km, avg_hr, max_hr,
    calories, data_source, rpe, client_request_id
  )
  values (
    day_log_id, p_activity_type, p_duration_seconds, p_distance_km, p_avg_hr, p_max_hr,
    p_calories, p_data_source, p_rpe, p_request_id
  )
  returning * into saved_session;
  return saved_session;
end;
$$;

create function public.get_recent_cardio(p_limit integer default 30)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with recent as (
    select sessions.id, logs.date, sessions.activity_type, sessions.duration_seconds,
      sessions.distance_km, sessions.avg_hr, sessions.max_hr, sessions.calories,
      sessions.data_source, sessions.rpe, sessions.created_at
    from public.cardio_sessions as sessions
    join public.workout_logs as logs on logs.id = sessions.workout_log_id
    where logs.user_id = auth.uid()
    order by logs.date desc, sessions.created_at desc, sessions.id desc
    limit greatest(1, least(coalesce(p_limit, 30), 100))
  )
  select coalesce(jsonb_agg(to_jsonb(recent) order by recent.date desc, recent.created_at desc, recent.id desc), '[]'::jsonb)
  from recent;
$$;

revoke all on function public.save_cardio_session(date, text, integer, numeric, integer, integer, integer, text, integer, uuid) from public, anon;
revoke all on function public.get_recent_cardio(integer) from public, anon;
grant execute on function public.save_cardio_session(date, text, integer, numeric, integer, integer, integer, text, integer, uuid) to authenticated;
grant execute on function public.get_recent_cardio(integer) to authenticated;

commit;
