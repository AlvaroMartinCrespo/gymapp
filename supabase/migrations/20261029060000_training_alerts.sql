begin;

alter table public.workout_logs add column completed_at timestamptz;
alter table public.ai_alerts add column analysis_week date;
alter table public.ai_alerts add column source_workout_log_id uuid references public.workout_logs(id) on delete cascade;
alter table public.ai_alerts add column rule_code text check (rule_code is null or rule_code = 'STAGNATION_V1');
create unique index ai_alerts_stagnation_week_uq on public.ai_alerts (user_id, exercise_id, analysis_week)
  where rule_code = 'STAGNATION_V1';

create function public.reopen_changed_workout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  if tg_op <> 'INSERT' then
    update public.workout_logs set completed_at = null where id = old.workout_log_id and completed_at is not null returning user_id into owner_id;
    if found then
      delete from public.ai_alerts where user_id = owner_id
        and exercise_id in (select exercise_id from public.workout_sets where workout_log_id = old.workout_log_id union select old.exercise_id)
        and rule_code = 'STAGNATION_V1' and not is_read;
    end if;
  end if;
  if tg_op <> 'DELETE' then
    update public.workout_logs set completed_at = null where id = new.workout_log_id and completed_at is not null returning user_id into owner_id;
    if found then
      delete from public.ai_alerts where user_id = owner_id
        and exercise_id in (select exercise_id from public.workout_sets where workout_log_id = new.workout_log_id union select new.exercise_id)
        and rule_code = 'STAGNATION_V1' and not is_read;
    end if;
  end if;
  return null;
end;
$$;

create trigger reopen_changed_workout after insert or update or delete on public.workout_sets
  for each row execute function public.reopen_changed_workout();
revoke all on function public.reopen_changed_workout() from public, anon, authenticated;

create function public.invalidate_changed_workout_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.completed_at is not null then
      delete from public.ai_alerts where user_id = old.user_id and rule_code = 'STAGNATION_V1' and not is_read
        and exercise_id in (select exercise_id from public.workout_sets where workout_log_id = old.id);
    end if;
    return old;
  end if;
  if old.date is distinct from new.date then
    new.completed_at := null;
    if old.completed_at is not null then
      delete from public.ai_alerts where user_id = old.user_id and rule_code = 'STAGNATION_V1' and not is_read
        and exercise_id in (select exercise_id from public.workout_sets where workout_log_id = old.id);
    end if;
  end if;
  return new;
end;
$$;
create trigger invalidate_changed_workout_log before update of date or delete on public.workout_logs
  for each row execute function public.invalidate_changed_workout_log();
revoke all on function public.invalidate_changed_workout_log() from public, anon, authenticated;

create function public.finish_workout(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user uuid := auth.uid();
  selected_log public.workout_logs;
  week_start date := date_trunc('week', p_date::timestamp)::date;
  selected_exercise text;
  stable_weeks boolean;
  inserted_count integer;
  alerts_created integer := 0;
begin
  if request_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_date is null or p_date < date '2000-01-01' or p_date > (now() at time zone 'UTC')::date + 1 then
    raise exception 'Invalid workout date' using errcode = '22023';
  end if;
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

create or replace function public.get_workout_session(p_date date, p_exercise_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with previous_day as (
    select max(logs.date) as date from public.workout_logs as logs
    join public.workout_sets as sets on sets.workout_log_id = logs.id
    where logs.user_id = auth.uid() and logs.date < p_date and sets.exercise_id = p_exercise_id
  ), selected_sets as (
    select sets.id, sets.set_number, sets.weight, sets.reps, sets.is_pr, logs.date
    from public.workout_sets as sets join public.workout_logs as logs on logs.id = sets.workout_log_id
    where logs.user_id = auth.uid() and sets.exercise_id = p_exercise_id
      and (logs.date = p_date or logs.date = (select date from previous_day))
  )
  select jsonb_build_object(
    'sets', coalesce((select jsonb_agg(to_jsonb(selected_sets) - 'date' order by set_number) from selected_sets where date = p_date), '[]'::jsonb),
    'previous_date', (select date from previous_day),
    'previous_sets', coalesce((select jsonb_agg(to_jsonb(selected_sets) - 'date' order by set_number) from selected_sets where date = (select date from previous_day)), '[]'::jsonb),
    'completed_at', (select completed_at from public.workout_logs where user_id = auth.uid() and date = p_date),
    'day_set_count', (select count(*) from public.workout_logs as logs join public.workout_sets as sets on sets.workout_log_id = logs.id where logs.user_id = auth.uid() and logs.date = p_date)
  );
$$;

create function public.get_training_alerts()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_id', auth.uid(),
    'alerts', coalesce((select jsonb_agg(to_jsonb(pending) order by created_at desc, id) from (
      select alerts.id, alerts.exercise_id, catalog.name as exercise, alerts.alert_type, alerts.message, alerts.created_at, alerts.analysis_week
      from public.ai_alerts as alerts join public.exercises_catalog as catalog on catalog.id = alerts.exercise_id
      where alerts.user_id = auth.uid() and not alerts.is_read order by alerts.created_at desc, alerts.id limit 5
    ) as pending), '[]'::jsonb)
  );
$$;

revoke all on function public.finish_workout(date) from public, anon;
revoke all on function public.get_training_alerts() from public, anon;
grant execute on function public.finish_workout(date) to authenticated;
grant execute on function public.get_training_alerts() to authenticated;

commit;