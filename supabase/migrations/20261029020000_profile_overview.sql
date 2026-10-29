begin;

create function public.get_profile_overview(p_date date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with history as (
    select logs.date, sets.id, sets.exercise_id, sets.weight, sets.reps, catalog.name, catalog.category
    from public.workout_logs as logs
    join public.workout_sets as sets on sets.workout_log_id = logs.id
    join public.exercises_catalog as catalog on catalog.id = sets.exercise_id
    where logs.user_id = auth.uid() and logs.date <= p_date
  ), period as (
    select * from history where date >= p_date - 27
  ), activity as (
    select p_date - 6 + days.day_number as date, count(history.id) as sets
    from generate_series(0, 6) as days(day_number)
    left join history on history.date = p_date - 6 + days.day_number
    group by days.day_number
  ), recent_days as (
    select date, count(*) as sets, sum(weight * reps) as volume
    from history group by date order by date desc limit 5
  ), best_sets as (
    select distinct on (exercise_id) exercise_id, name, category, weight, reps, date
    from history order by exercise_id, weight desc, reps desc, date desc, id
  ), best_marks as (
    select * from best_sets order by weight desc, reps desc, exercise_id limit 5
  )
  select jsonb_build_object(
    'profile', (select jsonb_build_object('id', id, 'username', username, 'avatar_url', avatar_url, 'created_at', created_at)
      from public.profiles where id = auth.uid()),
    'summary', (select jsonb_build_object('days', count(distinct date), 'sets', count(*), 'exercises', count(distinct exercise_id), 'volume', coalesce(sum(weight * reps), 0)) from period),
    'activity', (select jsonb_agg(to_jsonb(activity) order by date) from activity),
    'recent_days', coalesce((select jsonb_agg(to_jsonb(recent_days) order by date desc) from recent_days), '[]'::jsonb),
    'best_marks', coalesce((select jsonb_agg(to_jsonb(best_marks) order by weight desc, reps desc, exercise_id) from best_marks), '[]'::jsonb)
  );
$$;

revoke all on function public.get_profile_overview(date) from public, anon;
grant execute on function public.get_profile_overview(date) to authenticated;

commit;