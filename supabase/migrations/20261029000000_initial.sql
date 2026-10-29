begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  created_at timestamptz not null default now()
);
create unique index profiles_username_uq on public.profiles (lower(username));

create table public.exercises_catalog (
  id text primary key,
  name text not null,
  category text not null check (category in ('Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core')),
  primary_meshes jsonb not null check (jsonb_typeof(primary_meshes) = 'array' and jsonb_array_length(primary_meshes) > 0),
  secondary_meshes jsonb not null default '[]'::jsonb check (jsonb_typeof(secondary_meshes) = 'array'),
  default_camera text not null default 'front' check (default_camera in ('front', 'back'))
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  date date not null default current_date
);
create unique index workout_logs_user_date_uq on public.workout_logs (user_id, date);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id text not null references public.exercises_catalog(id),
  set_number integer not null check (set_number > 0),
  weight numeric(8, 2) not null check (weight >= 0),
  reps integer not null check (reps > 0),
  is_pr boolean not null default false
);
create index workout_sets_log_idx on public.workout_sets (workout_log_id);
create index workout_sets_exercise_idx on public.workout_sets (exercise_id);
create unique index workout_sets_number_uq on public.workout_sets (workout_log_id, exercise_id, set_number);

create table public.ai_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null references public.exercises_catalog(id),
  alert_type text not null check (alert_type in ('STAGNATION', 'FATIGUE')),
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index ai_alerts_user_idx on public.ai_alerts (user_id, is_read);

create table public.social_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('WORKOUT_SUMMARY', 'NEW_PR')),
  reference_id uuid not null,
  likes_count integer not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now()
);
create index social_feed_created_idx on public.social_feed (created_at);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'user_' || left(replace(new.id::text, '-', ''), 20))
  );
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.exercises_catalog enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_sets enable row level security;
alter table public.ai_alerts enable row level security;
alter table public.social_feed enable row level security;

revoke all on public.profiles, public.exercises_catalog, public.workout_logs,
  public.workout_sets, public.ai_alerts, public.social_feed from public, anon, authenticated;

grant select on public.exercises_catalog to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
grant select, delete on public.workout_logs to authenticated;
grant insert (user_id, date), update (date) on public.workout_logs to authenticated;
grant select, delete on public.workout_sets to authenticated;
grant insert (workout_log_id, exercise_id, set_number, weight, reps) on public.workout_sets to authenticated;
grant update (exercise_id, set_number, weight, reps) on public.workout_sets to authenticated;
grant select on public.ai_alerts to authenticated;
grant update (is_read) on public.ai_alerts to authenticated;
grant select on public.social_feed to authenticated;

create policy catalog_read on public.exercises_catalog
  for select to anon, authenticated using (true);
create policy profiles_read on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy logs_owner on public.workout_logs
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy sets_owner on public.workout_sets
  for all to authenticated
  using (exists (
    select 1 from public.workout_logs
    where workout_logs.id = workout_sets.workout_log_id and workout_logs.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workout_logs
    where workout_logs.id = workout_sets.workout_log_id and workout_logs.user_id = (select auth.uid())
  ));
create policy alerts_read on public.ai_alerts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy alerts_update on public.ai_alerts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy feed_read on public.social_feed
  for select to authenticated using (true);

commit;