-- Añade la foto de perfil (avatar_url) a cada entrada del ranking.
-- Misma firma que la función original: conserva permisos, pero se reafirman por seguridad.
begin;

create or replace function public.get_rankings(p_exercise_id text, p_metric text, p_page integer default 0, p_enabled boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  result jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_metric is null or p_metric not in ('weight', 'reps') or p_page is null or p_page < 0 or p_page > 10000
    or p_exercise_id is null or not exists (select 1 from public.exercises_catalog where id = p_exercise_id) then
    raise exception 'Invalid ranking filters' using errcode = '22023';
  end if;
  if p_enabled is not null then
    update public.profiles set rankings_enabled = p_enabled where id = owner_id;
  end if;

  with candidates as (
    select profiles.id, profiles.username, profiles.avatar_url, profiles.rankings_enabled, sets.weight, sets.reps,
      row_number() over (partition by profiles.id order by
        case when p_metric = 'weight' then sets.weight else sets.reps end desc,
        case when p_metric = 'weight' then sets.reps else sets.weight end desc,
        logs.date desc, sets.id) as choice
    from public.profiles
    join public.workout_logs as logs on logs.user_id = profiles.id
    join public.workout_sets as sets on sets.workout_log_id = logs.id
    where (profiles.rankings_enabled or profiles.id = owner_id)
      and sets.exercise_id = p_exercise_id and logs.completed_at is not null
      and logs.date <= (now() at time zone 'UTC')::date + 1
  ), best as (
    select * from candidates where choice = 1
  ), ranked as (
    select *, rank() over (order by case when p_metric = 'weight' then weight else reps end desc) as position,
      row_number() over (order by case when p_metric = 'weight' then weight else reps end desc, lower(username), id) as row_index
    from best where rankings_enabled
  ), visible as (
    select position, username, avatar_url, weight, reps, id = owner_id as is_me, row_index
    from ranked where row_index > p_page * 50 and row_index <= (p_page + 1) * 50
  )
  select jsonb_build_object(
    'exercise_id', p_exercise_id, 'metric', p_metric, 'page', p_page,
    'enabled', (select rankings_enabled from public.profiles where id = owner_id),
    'total', (select count(*) from ranked),
    'entries', coalesce((select jsonb_agg(to_jsonb(visible) - 'row_index' order by row_index) from visible), '[]'::jsonb),
    'personal', (select jsonb_build_object('weight', best.weight, 'reps', best.reps,
      'position', (select position from ranked where id = owner_id)) from best where id = owner_id)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_rankings(text, text, integer, boolean) from public, anon;
grant execute on function public.get_rankings(text, text, integer, boolean) to authenticated;

commit;
