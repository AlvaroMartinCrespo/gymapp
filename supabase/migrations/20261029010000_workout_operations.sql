begin;

alter table public.workout_sets add column client_request_id uuid;
create unique index workout_sets_request_uq on public.workout_sets (workout_log_id, client_request_id);
grant insert (client_request_id) on public.workout_sets to authenticated;

create function public.save_workout_set(
  p_date date,
  p_exercise_id text,
  p_weight numeric,
  p_reps integer,
  p_request_id uuid
)
returns public.workout_sets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  day_log_id uuid;
  next_number integer;
  saved_set public.workout_sets;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_date is null or p_date < '2000-01-01'::date or p_date > '2100-12-31'::date
    or p_request_id is null or p_weight is null or p_weight < 0 or p_weight > 10000
    or p_weight <> round(p_weight, 2) or p_reps is null or p_reps < 1 or p_reps > 1000 then
    raise exception 'Invalid workout data' using errcode = '22023';
  end if;
  if not exists (select 1 from public.exercises_catalog where id = p_exercise_id) then
    raise exception 'Unknown exercise' using errcode = '22023';
  end if;

  insert into public.workout_logs (user_id, date)
  values (auth.uid(), p_date)
  on conflict (user_id, date) do update set date = excluded.date
  returning id into day_log_id;

  select * into saved_set from public.workout_sets
  where workout_log_id = day_log_id and client_request_id = p_request_id;
  if found then
    if saved_set.exercise_id <> p_exercise_id or saved_set.weight <> p_weight or saved_set.reps <> p_reps then
      raise exception 'Request already used with different data' using errcode = '22023';
    end if;
    return saved_set;
  end if;

  select coalesce(max(set_number), 0) + 1 into next_number
  from public.workout_sets where workout_log_id = day_log_id and exercise_id = p_exercise_id;

  insert into public.workout_sets (workout_log_id, exercise_id, set_number, weight, reps, client_request_id)
  values (day_log_id, p_exercise_id, next_number, p_weight, p_reps, p_request_id)
  returning * into saved_set;
  return saved_set;
end;
$$;

create function public.get_workout_session(p_date date, p_exercise_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with previous_day as (
    select max(logs.date) as date
    from public.workout_logs as logs
    join public.workout_sets as sets on sets.workout_log_id = logs.id
    where logs.user_id = auth.uid() and logs.date < p_date and sets.exercise_id = p_exercise_id
  ), selected_sets as (
    select sets.id, sets.set_number, sets.weight, sets.reps, sets.is_pr, logs.date
    from public.workout_sets as sets
    join public.workout_logs as logs on logs.id = sets.workout_log_id
    where logs.user_id = auth.uid() and sets.exercise_id = p_exercise_id
      and (logs.date = p_date or logs.date = (select date from previous_day))
  )
  select jsonb_build_object(
    'sets', coalesce((select jsonb_agg(to_jsonb(selected_sets) - 'date' order by set_number) from selected_sets where date = p_date), '[]'::jsonb),
    'previous_date', (select date from previous_day),
    'previous_sets', coalesce((select jsonb_agg(to_jsonb(selected_sets) - 'date' order by set_number) from selected_sets where date = (select date from previous_day)), '[]'::jsonb)
  );
$$;

revoke all on function public.save_workout_set(date, text, numeric, integer, uuid) from public, anon;
revoke all on function public.get_workout_session(date, text) from public, anon;
grant execute on function public.save_workout_set(date, text, numeric, integer, uuid) to authenticated;
grant execute on function public.get_workout_session(date, text) to authenticated;

commit;