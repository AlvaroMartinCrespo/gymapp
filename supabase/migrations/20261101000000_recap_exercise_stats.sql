begin;

-- Per-exercise comparison between the current recap period and the previous one.
-- Used to give the AI a compact, owner-scoped view of weight and rep progress.
-- SECURITY INVOKER, so the underlying RLS policies still apply.
create function public.get_recap_exercise_stats(p_date date, p_period text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_date is null or p_date < date '2000-01-01' or p_date > date '2100-12-31'
    or p_period is null or p_period not in ('week', 'month', 'year') then
    raise exception 'Invalid recap period' using errcode = '22023';
  end if;
  return (
    with current_range as (
      select date_trunc(p_period, p_date::timestamp)::date as current_start
    ), previous_range as (
      select current_start, (current_start - case p_period when 'week' then interval '1 week' when 'month' then interval '1 month' else interval '1 year' end)::date as previous_start
      from current_range
    ), ranges as (
      select current_start, p_date as current_end, previous_start,
        least(current_start - 1, previous_start + (p_date - current_start)) as previous_end
      from previous_range
    ), history as (
      select sets.exercise_id, catalog.name as exercise, catalog.category, sets.weight, sets.reps,
        (logs.date >= ranges.current_start) as is_current
      from public.workout_logs as logs
      join public.workout_sets as sets on sets.workout_log_id = logs.id
      join public.exercises_catalog as catalog on catalog.id = sets.exercise_id
      cross join ranges
      where logs.user_id = auth.uid()
        and ((logs.date between ranges.previous_start and ranges.previous_end)
          or (logs.date between ranges.current_start and ranges.current_end))
    ), per_exercise as (
      select exercise_id, min(exercise) as exercise, min(category) as category,
        count(*) filter (where is_current) as current_sets,
        count(*) filter (where not is_current) as previous_sets,
        coalesce(sum(reps) filter (where is_current), 0) as current_reps,
        coalesce(sum(reps) filter (where not is_current), 0) as previous_reps,
        coalesce(max(weight) filter (where is_current), 0) as current_max_weight,
        coalesce(max(weight) filter (where not is_current), 0) as previous_max_weight,
        coalesce(sum(weight * reps) filter (where is_current), 0) as current_volume,
        coalesce(sum(weight * reps) filter (where not is_current), 0) as previous_volume
      from history
      group by exercise_id
    ), limited as (
      select * from per_exercise order by current_volume desc, previous_volume desc, exercise_id limit 12
    )
    select jsonb_build_object(
      'profile', (select jsonb_build_object('id', profiles.id) from public.profiles where profiles.id = auth.uid()),
      'date', p_date, 'period', p_period, 'range', (select to_jsonb(ranges) from ranges),
      'exercises_total', (select count(*) from per_exercise),
      'exercises', coalesce((select jsonb_agg(to_jsonb(limited) order by current_volume desc, previous_volume desc, exercise_id) from limited), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_recap_exercise_stats(date, text) from public, anon;
grant execute on function public.get_recap_exercise_stats(date, text) to authenticated;

commit;
