-- Finalización automática de entrenamientos de días ya terminados.
-- Aplicar después de las nueve migraciones anteriores.
-- 1) Extrae la lógica de finalización a finish_workout_core (sin cambiar su comportamiento).
-- 2) finish_workout sigue siendo la función que usa la app: valida sesión y fecha y delega.
-- 3) auto_finish_past_workouts finaliza los días anteriores a hoy (hora de Madrid) que
--    tengan series y no estén finalizados. Solo la ejecuta el programador (pg_cron) o el
--    propietario de la base de datos; ni anon ni authenticated pueden llamarla.
begin;

-- Lógica compartida. No comprueba sesión: nunca se concede a clientes.
create function public.finish_workout_core(request_user uuid, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_log public.workout_logs;
  week_start date := date_trunc('week', p_date::timestamp)::date;
  selected_exercise text;
  stable_weeks boolean;
  inserted_count integer;
  alerts_created integer := 0;
begin
  select * into selected_log from public.workout_logs where user_id = request_user and date = p_date for update;
  if not found or not exists (select 1 from public.workout_sets where workout_log_id = selected_log.id) then
    raise exception 'No workout sets' using errcode = '22023';
  end if;
  if selected_log.completed_at is not null then
    return jsonb_build_object('date', p_date, 'completed_at', selected_log.completed_at, 'alerts_created', 0);
  end if;
  perform 1 from public.workout_logs where user_id = request_user and date between week_start - 14 and p_date order by date, id for update;
  update public.workout_logs set completed_at = now() where id = selected_log.id returning * into selected_log;

  for selected_exercise in select distinct exercise_id from public.workout_sets where workout_log_id = selected_log.id loop
    with completed_sets as (
      select logs.date, date_trunc('week', logs.date::timestamp)::date as week, sets.id, sets.weight, sets.reps
      from public.workout_logs as logs join public.workout_sets as sets on sets.workout_log_id = logs.id
      where logs.user_id = request_user and logs.completed_at is not null and sets.exercise_id = selected_exercise
        and logs.date between week_start - 14 and p_date
    ), weekly_counts as (
      select week, count(distinct date) as sessions from completed_sets group by week
    ), weekly_best as (
      select distinct on (week) week, weight, reps from completed_sets
      order by week, weight desc, reps desc, date desc, id
    )
    select count(*) = 3 and coalesce(bool_and(weekly_counts.sessions >= 2), false)
      and min(weekly_best.weight) = max(weekly_best.weight) and min(weekly_best.reps) = max(weekly_best.reps)
    into stable_weeks from weekly_best join weekly_counts using (week);

    if stable_weeks then
      insert into public.ai_alerts (user_id, exercise_id, alert_type, message, analysis_week, source_workout_log_id, rule_code)
      values (request_user, selected_exercise, 'STAGNATION',
        'Tu mejor serie por carga y repeticiones se ha mantenido igual en tres semanas consecutivas, con al menos dos sesiones completadas por semana. Revisa tus objetivos y recuperacion; esto no demuestra fatiga ni prescribe una descarga.',
        week_start, selected_log.id, 'STAGNATION_V1')
      on conflict (user_id, exercise_id, analysis_week) where rule_code = 'STAGNATION_V1' do nothing;
      get diagnostics inserted_count = row_count;
      alerts_created := alerts_created + inserted_count;
    else
      delete from public.ai_alerts where user_id = request_user and exercise_id = selected_exercise and rule_code = 'STAGNATION_V1' and not is_read;
    end if;
  end loop;
  return jsonb_build_object('date', p_date, 'completed_at', selected_log.completed_at, 'alerts_created', alerts_created);
end;
$$;

create or replace function public.finish_workout(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user uuid := auth.uid();
begin
  if request_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_date is null or p_date < date '2000-01-01' or p_date > (now() at time zone 'UTC')::date + 1 then
    raise exception 'Invalid workout date' using errcode = '22023';
  end if;
  return public.finish_workout_core(request_user, p_date);
end;
$$;

create function public.auto_finish_past_workouts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending record;
  finished integer := 0;
  -- Cambiar la zona horaria aquí si los usuarios no están en España.
  cutoff date := (now() at time zone 'Europe/Madrid')::date;
begin
  -- Orden cronológico por usuario: el aviso de estancamiento mira semanas anteriores finalizadas.
  -- Máximo 500 por ejecución para no bloquear; la siguiente ejecución continúa.
  for pending in
    select logs.user_id, logs.date
    from public.workout_logs as logs
    where logs.completed_at is null and logs.date < cutoff
      and exists (select 1 from public.workout_sets as sets where sets.workout_log_id = logs.id)
    order by logs.user_id, logs.date
    limit 500
  loop
    begin
      perform public.finish_workout_core(pending.user_id, pending.date);
      finished := finished + 1;
    exception when others then
      raise warning 'auto_finish_past_workouts omitió un entrenamiento: %', sqlstate;
    end;
  end loop;
  return finished;
end;
$$;

revoke all on function public.finish_workout_core(uuid, date) from public, anon, authenticated;
revoke all on function public.auto_finish_past_workouts() from public, anon, authenticated;
revoke all on function public.finish_workout(date) from public, anon;
grant execute on function public.finish_workout(date) to authenticated;

commit;
