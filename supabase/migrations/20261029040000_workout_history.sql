begin;

create function public.get_workout_history(p_date date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with month_range as (
    select date_trunc('month', p_date::timestamp)::date as first_day,
      (date_trunc('month', p_date::timestamp) + interval '1 month')::date as next_month
  ), monthly_sets as (
    select logs.date, sets.id, sets.exercise_id, sets.set_number, sets.weight, sets.reps,
      catalog.name, catalog.category
    from public.workout_logs as logs
    join public.workout_sets as sets on sets.workout_log_id = logs.id
    join public.exercises_catalog as catalog on catalog.id = sets.exercise_id
    cross join month_range
    where logs.user_id = auth.uid() and logs.date >= month_range.first_day and logs.date < month_range.next_month
  ), active_days as (
    select date, count(*) as sets, sum(weight * reps) as volume
    from monthly_sets group by date
  ), selected_sets as (
    select id, exercise_id, name, category, set_number, weight, reps
    from monthly_sets where date = p_date
  )
  select jsonb_build_object(
    'profile', (select jsonb_build_object('id', profiles.id) from public.profiles where profiles.id = auth.uid()),
    'month', (select first_day from month_range),
    'date', p_date,
    'summary', (select jsonb_build_object('days', count(distinct date), 'sets', count(*), 'exercises', count(distinct exercise_id), 'volume', coalesce(sum(weight * reps), 0)) from monthly_sets),
    'days', coalesce((select jsonb_agg(to_jsonb(active_days) order by date) from active_days), '[]'::jsonb),
    'sets', coalesce((select jsonb_agg(to_jsonb(selected_sets) order by category, name, exercise_id, set_number, id) from selected_sets), '[]'::jsonb)
  );
$$;

revoke all on function public.get_workout_history(date) from public, anon;
grant execute on function public.get_workout_history(date) to authenticated;

commit;