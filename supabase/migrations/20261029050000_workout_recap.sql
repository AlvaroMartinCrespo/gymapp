begin;

create function public.get_workout_recap(p_date date, p_period text)
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
    ), periods as (
      select 'current' as name, current_start as start_date, current_end as end_date from ranges
      union all
      select 'previous', previous_start, previous_end from ranges
    ), history as (
      select logs.date, sets.id, sets.exercise_id, sets.weight, sets.reps, catalog.category
      from public.workout_logs as logs
      join public.workout_sets as sets on sets.workout_log_id = logs.id
      join public.exercises_catalog as catalog on catalog.id = sets.exercise_id
      cross join ranges
      where logs.user_id = auth.uid() and logs.date between ranges.previous_start and ranges.current_end
    ), summaries as (
      select periods.name, count(history.id) as sets, count(distinct history.date) as days,
        count(distinct history.exercise_id) as exercises, coalesce(sum(history.weight * history.reps), 0) as volume
      from periods left join history on history.date between periods.start_date and periods.end_date
      group by periods.name
    ), current_sets as (
      select history.* from history cross join ranges where history.date between ranges.current_start and ranges.current_end
    ), bucket_dates as (
      select bucket::date as date from ranges,
        generate_series(ranges.current_start::timestamp, ranges.current_end::timestamp,
          case when p_period = 'year' then interval '1 month' else interval '1 day' end) as bucket
    ), buckets as (
      select bucket_dates.date, count(current_sets.id) as sets, coalesce(sum(current_sets.weight * current_sets.reps), 0) as volume
      from bucket_dates left join current_sets on
        case when p_period = 'year' then date_trunc('month', current_sets.date::timestamp)::date else current_sets.date end = bucket_dates.date
      group by bucket_dates.date
    ), categories as (
      select catalog.category, count(current_sets.id) as sets, coalesce(sum(current_sets.weight * current_sets.reps), 0) as volume
      from (select distinct category from public.exercises_catalog) as catalog
      left join current_sets on current_sets.category = catalog.category
      group by catalog.category
    )
    select jsonb_build_object(
      'profile', (select jsonb_build_object('id', profiles.id) from public.profiles where profiles.id = auth.uid()),
      'date', p_date, 'period', p_period, 'range', (select to_jsonb(ranges) from ranges),
      'current', (select jsonb_build_object('days', days, 'sets', sets, 'exercises', exercises, 'volume', volume) from summaries where name = 'current'),
      'previous', (select jsonb_build_object('days', days, 'sets', sets, 'exercises', exercises, 'volume', volume) from summaries where name = 'previous'),
      'buckets', coalesce((select jsonb_agg(to_jsonb(buckets) order by date) from buckets), '[]'::jsonb),
      'categories', coalesce((select jsonb_agg(to_jsonb(categories) order by sets desc, category) from categories), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_workout_recap(date, text) from public, anon;
grant execute on function public.get_workout_recap(date, text) to authenticated;

commit;