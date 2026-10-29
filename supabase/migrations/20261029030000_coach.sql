begin;

create table public.coach_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  requests integer not null check (requests between 1 and 50),
  minute_start timestamptz not null,
  minute_requests integer not null check (minute_requests between 1 and 5),
  primary key (user_id, day)
);
alter table public.coach_usage enable row level security;
revoke all on public.coach_usage from public, anon, authenticated;

create function public.claim_coach_request()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user uuid := auth.uid();
  utc_day date := (now() at time zone 'UTC')::date;
  minute_now timestamptz := date_trunc('minute', now());
  usage_row public.coach_usage;
  retry_seconds integer;
begin
  if request_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.coach_usage (user_id, day, requests, minute_start, minute_requests)
  values (request_user, utc_day, 1, minute_now, 1)
  on conflict (user_id, day) do update
  set requests = coach_usage.requests + 1,
      minute_start = excluded.minute_start,
      minute_requests = case when coach_usage.minute_start = excluded.minute_start then coach_usage.minute_requests + 1 else 1 end
  where coach_usage.requests < 50
    and (coach_usage.minute_start <> excluded.minute_start or coach_usage.minute_requests < 5)
  returning * into usage_row;
  if not found then
    select * into usage_row from public.coach_usage where user_id = request_user and day = utc_day;
    retry_seconds := greatest(1, ceil(extract(epoch from (
      case when usage_row.requests >= 50 then ((utc_day + 1)::timestamp at time zone 'UTC') else minute_now + interval '1 minute' end - now()
    )))::integer);
    return jsonb_build_object('allowed', false, 'retry_after', retry_seconds);
  end if;
  return jsonb_build_object('allowed', true, 'remaining_today', 50 - usage_row.requests);
end;
$$;

create function public.get_coach_context(p_date date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with history as (
    select logs.date, date_trunc('week', logs.date::timestamp)::date as week,
      sets.id, sets.exercise_id, catalog.name as exercise, catalog.category, sets.weight, sets.reps
    from public.workout_logs as logs
    join public.workout_sets as sets on sets.workout_log_id = logs.id
    join public.exercises_catalog as catalog on catalog.id = sets.exercise_id
    where logs.user_id = auth.uid() and logs.date between p_date - 27 and p_date
  ), weekly_totals as (
    select week, exercise_id, count(*) as sets, sum(weight * reps) as volume
    from history group by week, exercise_id
  ), weekly_best as (
    select distinct on (week, exercise_id) week, exercise_id, exercise, category, weight, reps
    from history order by week, exercise_id, weight desc, reps desc, date desc, id
  ), weekly_all as (
    select totals.week, totals.exercise_id, best.exercise, best.category, totals.sets, totals.volume, best.weight, best.reps
    from weekly_totals as totals join weekly_best as best using (week, exercise_id)
  ), weekly_limited as (
    select * from weekly_all order by week desc, exercise_id limit 80
  ), catalog_limited as (
    select id, name, category from public.exercises_catalog order by category, name, id limit 60
  ), active_alerts as (
    select alerts.exercise_id, catalog.name as exercise, alerts.alert_type, alerts.created_at
    from public.ai_alerts as alerts
    join public.exercises_catalog as catalog on catalog.id = alerts.exercise_id
    where alerts.user_id = auth.uid() and not alerts.is_read
      and alerts.created_at >= ((p_date - 27)::timestamp at time zone 'UTC')
      and alerts.created_at < ((p_date + 1)::timestamp at time zone 'UTC')
    order by alerts.created_at desc, alerts.id limit 5
  )
  select jsonb_build_object(
    'range_start', p_date - 27,
    'range_end', p_date,
    'summary', (select jsonb_build_object('days', count(distinct date), 'sets', count(*), 'exercises', count(distinct exercise_id), 'volume', coalesce(sum(weight * reps), 0)) from history),
    'weekly_total', (select count(*) from weekly_all),
    'weekly', coalesce((select jsonb_agg(to_jsonb(weekly_limited) order by week desc, exercise_id) from weekly_limited), '[]'::jsonb),
    'catalog', coalesce((select jsonb_agg(to_jsonb(catalog_limited) order by category, name, id) from catalog_limited), '[]'::jsonb),
    'alerts', coalesce((select jsonb_agg(to_jsonb(active_alerts) order by created_at desc) from active_alerts), '[]'::jsonb)
  );
$$;

revoke all on function public.claim_coach_request() from public, anon;
revoke all on function public.get_coach_context(date) from public, anon;
grant execute on function public.claim_coach_request() to authenticated;
grant execute on function public.get_coach_context(date) to authenticated;

commit;