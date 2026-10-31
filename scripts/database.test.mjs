import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createSeedSql } from "./seed.mjs";

const migration = readFileSync(new URL("../supabase/migrations/20261029000000_initial.sql", import.meta.url), "utf8");
const operations = readFileSync(new URL("../supabase/migrations/20261029010000_workout_operations.sql", import.meta.url), "utf8");
const profileOverview = readFileSync(new URL("../supabase/migrations/20261029020000_profile_overview.sql", import.meta.url), "utf8");
const coach = readFileSync(new URL("../supabase/migrations/20261029030000_coach.sql", import.meta.url), "utf8");
const history = readFileSync(new URL("../supabase/migrations/20261029040000_workout_history.sql", import.meta.url), "utf8");
const recap = readFileSync(new URL("../supabase/migrations/20261029050000_workout_recap.sql", import.meta.url), "utf8");
const trainingAlerts = readFileSync(new URL("../supabase/migrations/20261029060000_training_alerts.sql", import.meta.url), "utf8");

test("las alertas se calculan al finalizar, con muestras completas y sin duplicados semanales", () => {
  assert.match(trainingAlerts, /request_user uuid := auth.uid\(\)/);
  assert.match(trainingAlerts, /where user_id = request_user and date = p_date for update/);
  assert.match(trainingAlerts, /logs.completed_at is not null/);
  assert.match(trainingAlerts, /count\(\*\) = 3/);
  assert.match(trainingAlerts, /weekly_counts.sessions >= 2/);
  assert.match(trainingAlerts, /min\(weekly_best.weight\) = max\(weekly_best.weight\)/);
  assert.match(trainingAlerts, /min\(weekly_best.reps\) = max\(weekly_best.reps\)/);
  assert.match(trainingAlerts, /on conflict[\s\S]*do nothing/);
  assert.match(trainingAlerts, /after insert or update or delete on public.workout_sets/);
  assert.match(trainingAlerts, /revoke all on function public.reopen_changed_workout\(\) from public, anon, authenticated/);
  assert.doesNotMatch(trainingAlerts, /grant update[\s\S]*completed_at/i);
});

test("el recap conserva RLS, periodos comparables y días sin series a cero", () => {
  assert.match(recap, /security invoker/);
  assert.match(recap, /set search_path = ''/);
  assert.doesNotMatch(recap, /security definer/);
  assert.match(recap, /logs.user_id = auth.uid\(\)/);
  assert.match(recap, /join public.workout_sets/);
  assert.match(recap, /least\(current_start - 1, previous_start \+ \(p_date - current_start\)\)/);
  assert.match(recap, /generate_series/);
  assert.match(recap, /count\(history.id\)/);
  assert.match(recap, /from public, anon/);
});

test("el historial limita el mes, exige propietario y solo cuenta dias con series", () => {
  assert.match(history, /security invoker/);
  assert.match(history, /set search_path = ''/);
  assert.doesNotMatch(history, /security definer/);
  assert.match(history, /logs.user_id = auth.uid\(\)/);
  assert.match(history, /join public.workout_sets/);
  assert.match(history, /logs.date >= month_range.first_day and logs.date < month_range.next_month/);
  assert.match(history, /from monthly_sets where date = p_date/);
  assert.match(history, /order by category, name, exercise_id, set_number, id/);
  assert.match(history, /revoke all on function public.get_workout_history\(date\) from public, anon/);
});

test("el contexto IA conserva RLS y su cuota no puede modificarse desde el cliente", () => {
  assert.match(coach, /alter table public.coach_usage enable row level security/);
  assert.match(coach, /revoke all on public.coach_usage from public, anon, authenticated/);
  assert.match(coach, /request_user uuid := auth.uid\(\)/);
  assert.match(coach, /on conflict \(user_id, day\) do update/);
  assert.match(coach, /coach_usage.requests < 50/);
  assert.match(coach, /coach_usage.minute_requests < 5/);
  assert.match(coach, /create function public.get_coach_context[\s\S]*security invoker/);
  assert.match(coach, /logs.user_id = auth.uid\(\)/);
  assert.match(coach, /between p_date - 27 and p_date/);
  assert.doesNotMatch(coach, /email|password|avatar_url|alerts.message/);
});

test("el resumen de perfil conserva RLS y calcula las marcas sobre una serie real", () => {
  assert.match(profileOverview, /security invoker/);
  assert.doesNotMatch(profileOverview, /security definer/);
  assert.match(profileOverview, /logs.user_id = auth.uid\(\)/);
  assert.match(profileOverview, /join public.workout_sets/);
  assert.match(profileOverview, /select distinct on \(exercise_id\)/);
  assert.match(profileOverview, /order by exercise_id, weight desc, reps desc/);
  assert.match(profileOverview, /date >= p_date - 27/);
  assert.match(profileOverview, /from public, anon/);
});

test("el guardado conserva RLS, bloquea el entrenamiento y deduplica las peticiones", () => {
  assert.equal([...operations.matchAll(/security invoker/g)].length, 2);
  assert.doesNotMatch(operations, /security definer/);
  assert.match(operations, /on conflict \(user_id, date\) do update/);
  assert.match(operations, /unique index workout_sets_request_uq/);
  assert.match(operations, /client_request_id = p_request_id/);
  assert.match(operations, /grant execute on function public.save_workout_set[^;]+to authenticated/);
  assert.match(operations, /logs.date < p_date/);
});

test("las seis tablas públicas tienen RLS habilitado", () => {
  const tables = [...migration.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);
  assert.equal(tables.length, 6);
  for (const table of tables) {
    assert.ok(migration.includes(`alter table public.${table} enable row level security;`), table);
  }
});

test("la identidad referencia Supabase Auth y no contiene contraseñas ni sesiones propias", () => {
  assert.match(migration, /references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /after insert on auth\.users/);
  assert.match(migration, /security definer\s+set search_path = ''/);
  assert.doesNotMatch(migration, /password_hash|create table public\.sessions/);
});

test("los permisos reservan los récords, alertas y publicaciones al servidor", () => {
  assert.match(migration, /grant insert \(workout_log_id, exercise_id, set_number, weight, reps\)/);
  assert.doesNotMatch(migration, /grant (?:insert|update) \([^)]*is_pr/);
  assert.match(migration, /grant update \(is_read\) on public.ai_alerts/);
  assert.doesNotMatch(migration, /grant (?:insert|update|all)[^;]*on public.social_feed/);
  assert.match(migration, /with check \(\(select auth.uid\(\)\) = user_id\)/);
});

test("RLS real en una base Supabase de pruebas ya migrada", {
  skip: !process.env.SUPABASE_TEST_DATABASE_URL && "Falta SUPABASE_TEST_DATABASE_URL y un cliente psql disponible",
}, () => {
  const checks = readFileSync(new URL("../supabase/tests/rls.sql", import.meta.url), "utf8");
  const result = spawnSync("psql", ["-X", "--set", "ON_ERROR_STOP=1"], {
    encoding: "utf8",
    env: { ...process.env, PGDATABASE: process.env.SUPABASE_TEST_DATABASE_URL },
    input: `begin;\n${createSeedSql()}\n${createSeedSql()}\n${checks}\nrollback;\n`,
    timeout: 30000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, "Falló la prueba PostgreSQL/RLS; revisa la base de pruebas y sus permisos.");
});
const autoFinish = readFileSync(new URL("../supabase/migrations/20261030000000_auto_finish_workouts.sql", import.meta.url), "utf8");
const autoFinishCron = readFileSync(new URL("../supabase/cron/auto_finish_workouts.sql", import.meta.url), "utf8");

test("la finalización automática solo toca días pasados y no se concede a clientes", () => {
  assert.match(autoFinish, /create function public\.finish_workout_core\(request_user uuid, p_date date\)/);
  assert.match(autoFinish, /create or replace function public\.finish_workout\(p_date date\)[\s\S]*request_user uuid := auth\.uid\(\)[\s\S]*return public\.finish_workout_core\(request_user, p_date\)/);
  assert.match(autoFinish, /logs\.completed_at is null and logs\.date < cutoff/);
  assert.match(autoFinish, /exists \(select 1 from public\.workout_sets as sets where sets\.workout_log_id = logs\.id\)/);
  assert.match(autoFinish, /order by logs\.user_id, logs\.date\s+limit 500/);
  assert.match(autoFinish, /revoke all on function public\.finish_workout_core\(uuid, date\) from public, anon, authenticated/);
  assert.match(autoFinish, /revoke all on function public\.auto_finish_past_workouts\(\) from public, anon, authenticated/);
  assert.doesNotMatch(autoFinish, /grant execute on function public\.(finish_workout_core|auto_finish_past_workouts)/);
  assert.match(autoFinish, /grant execute on function public\.finish_workout\(date\) to authenticated/);
  assert.match(autoFinishCron, /cron\.schedule\(\s*'auto-finish-workouts'/);
});

const cardio = readFileSync(new URL("../supabase/migrations/20261031000000_cardio_sessions.sql", import.meta.url), "utf8");
const schemaTs = readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8");

test("el cardio cuelga del log del día, con RLS por propietario y sin fecha duplicada", () => {
  assert.match(cardio, /create table public\.cardio_sessions/);
  assert.match(cardio, /workout_log_id uuid not null references public\.workout_logs\(id\) on delete cascade/);
  assert.doesNotMatch(cardio, /\n\s+date date/);
  assert.match(cardio, /alter table public\.cardio_sessions enable row level security/);
  assert.match(cardio, /revoke all on public\.cardio_sessions from public, anon, authenticated/);
  assert.match(cardio, /workout_logs\.user_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(cardio, /security definer/);
  assert.doesNotMatch(cardio, /grant[^;]*\bto anon\b/);
});

test("el cardio usa un catálogo cerrado y restricciones de datos razonables", () => {
  for (const activity of ["treadmill", "running", "walking", "stationary_bike", "elliptical", "rowing", "jump_rope", "swimming"]) {
    assert.ok(cardio.includes(`'${activity}'`), activity);
    assert.ok(schemaTs.includes(`"${activity}"`), `schema.ts ${activity}`);
  }
  assert.match(cardio, /duration_seconds between 1 and 86400/);
  assert.match(cardio, /rpe between 1 and 10/);
  assert.match(cardio, /max_hr >= avg_hr/);
  assert.match(cardio, /unique index cardio_sessions_request_uq on public\.cardio_sessions \(workout_log_id, client_request_id\)/);
});

test("el origen sensor está reservado al servidor y la sesión no migra de entrenamiento", () => {
  assert.match(cardio, /data_source in \('manual', 'estimated'\)/);
  const updateGrant = cardio.match(/grant update \(([^)]*)\)\s+on public\.cardio_sessions/);
  assert.ok(updateGrant, "falta el grant update por columnas");
  assert.doesNotMatch(updateGrant[1], /workout_log_id/);
  assert.doesNotMatch(cardio, /grant (?:insert|update) \([^)]*\bcreated_at\b/);
});

test("el cardio no altera las funciones de fuerza", () => {
  const code = cardio.replace(/^\s*--.*$/gm, "");
  assert.doesNotMatch(code, /create (?:or replace )?function/);
  assert.doesNotMatch(code, /workout_sets/);
});

const cardioOps = readFileSync(new URL("../supabase/migrations/20261031010000_cardio_operations.sql", import.meta.url), "utf8");

test("las operaciones de cardio son security invoker, idempotentes y sin acceso anónimo", () => {
  assert.match(cardioOps, /create function public\.save_cardio_session\(/);
  assert.match(cardioOps, /create function public\.get_recent_cardio\(/);
  const ops = cardioOps.replace(/^\s*--.*$/gm, "");
  assert.doesNotMatch(ops, /security definer/);
  assert.equal((ops.match(/security invoker/g) ?? []).length, 2);
  assert.equal((ops.match(/set search_path = ''/g) ?? []).length, 2);
  assert.match(cardioOps, /on conflict \(user_id, date\) do update set date = excluded\.date/);
  assert.match(cardioOps, /client_request_id = p_request_id/);
  assert.match(cardioOps, /Request already used with different data/);
  assert.match(cardioOps, /revoke all on function public\.save_cardio_session\([^)]*\) from public, anon/);
  assert.match(cardioOps, /revoke all on function public\.get_recent_cardio\(integer\) from public, anon/);
  assert.match(cardioOps, /grant execute on function public\.save_cardio_session\([^)]*\) to authenticated/);
  assert.match(cardioOps, /grant execute on function public\.get_recent_cardio\(integer\) to authenticated/);
  assert.doesNotMatch(cardioOps, /grant[^;]*\bto anon\b/);
});

test("las operaciones de cardio validan lo mismo que la tabla y no aceptan 'sensor'", () => {
  for (const activity of ["treadmill", "running", "walking", "stationary_bike", "elliptical", "rowing", "jump_rope", "swimming"]) assert.ok(cardioOps.includes(`'${activity}'`), activity);
  assert.match(cardioOps, /p_duration_seconds not between 1 and 86400/);
  assert.match(cardioOps, /p_data_source not in \('manual', 'estimated'\)/);
  assert.match(cardioOps, /p_data_source = 'estimated' and p_calories is null/);
  assert.match(cardioOps, /p_rpe not between 1 and 10/);
  assert.match(cardioOps, /p_max_hr < p_avg_hr/);
  assert.match(cardioOps, /least\(coalesce\(p_limit, 30\), 100\)/);
});

test("las operaciones de cardio no tocan las tablas ni las funciones de fuerza", () => {
  const code = cardioOps.replace(/^\s*--.*$/gm, "");
  assert.doesNotMatch(code, /workout_sets/);
  assert.doesNotMatch(code, /create or replace function/);
  assert.doesNotMatch(code, /(?:alter|drop) (?:table|function)/);
  assert.doesNotMatch(code, /\b(?:insert into|update|delete from) public\.workout_sets\b/);
});
