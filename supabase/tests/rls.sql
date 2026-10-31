insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'rls-a@example.test', '{"username":"rls_test_a"}'),
  ('00000000-0000-4000-8000-000000000002', 'rls-b@example.test', '{"username":"rls_test_b"}');

insert into public.workout_logs (id, user_id, date) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', current_date),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', current_date);

insert into public.coach_usage (user_id, day, requests, minute_start, minute_requests) values
  ('00000000-0000-4000-8000-000000000001', (now() at time zone 'UTC')::date - 1, 50, date_trunc('minute', now()) - interval '1 day', 1),
  ('00000000-0000-4000-8000-000000000002', (now() at time zone 'UTC')::date, 50, date_trunc('minute', now()), 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into public.workout_sets (workout_log_id, exercise_id, set_number, weight, reps)
values ('10000000-0000-4000-8000-000000000001', 'bench_press', 1, 60, 10);

-- The ninth migration must count the catalog's actual identifiers, without
-- turning secondary muscles into primary series or leaking another owner.
do $$
declare
  recap jsonb := public.get_workout_recap(current_date, 'week');
begin
  if jsonb_array_length(recap -> 'muscles') is distinct from 3 then
    raise exception 'El recap muscular no conserva los tres musculos del press';
  end if;
  if (select count(*) from jsonb_array_elements(recap -> 'muscles') as muscle(value)
      where value ->> 'mesh' = 'pectoralis_major' and (value ->> 'primary_sets')::integer = 1
        and (value ->> 'secondary_sets')::integer = 0) <> 1 then
    raise exception 'El pecho no cuenta exactamente una serie principal';
  end if;
  if (select count(*) from jsonb_array_elements(recap -> 'muscles') as muscle(value)
      where value ->> 'mesh' in ('triceps', 'anterior_deltoid') and (value ->> 'primary_sets')::integer = 0
        and (value ->> 'secondary_sets')::integer = 1) <> 2 then
    raise exception 'Los secundarios se cuentan como principales o se duplican';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if public.get_workout_recap(current_date, 'week') -> 'muscles' is distinct from '[]'::jsonb then
    raise exception 'El recap muscular filtra las series de otro propietario';
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'Se filtran perfiles ajenos';
  end if;
  if (select count(*) from public.workout_logs) <> 1 then
    raise exception 'Se filtran entrenamientos ajenos';
  end if;
  if (select count(*) from public.workout_sets) <> 1 then
    raise exception 'La serie propia no se ha guardado';
  end if;
  begin
    insert into public.workout_sets (workout_log_id, exercise_id, set_number, weight, reps)
    values ('10000000-0000-4000-8000-000000000002', 'bench_press', 1, 60, 10);
    raise exception 'Se permite escribir en entrenamientos ajenos';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.workout_sets set is_pr = true;
    raise exception 'Se permite falsificar un record';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.exercises_catalog (id, name, category, primary_meshes)
    values ('fake', 'Fake', 'Pecho', '["pectoralis_major"]');
    raise exception 'Se permite modificar el catalogo cerrado';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

do $$
declare
  saved public.workout_sets;
  repeated public.workout_sets;
  previous jsonb;
begin
  saved := public.save_workout_set(current_date, 'bench_press', 60, 10, '20000000-0000-4000-8000-000000000001');
  repeated := public.save_workout_set(current_date, 'bench_press', 60, 10, '20000000-0000-4000-8000-000000000001');
  if saved.id <> repeated.id or saved.set_number <> 2 then
    raise exception 'El reintento duplica o desordena las series';
  end if;
  if (select count(*) from public.workout_sets) <> 2 then
    raise exception 'El guardado ha creado una serie extra';
  end if;
  begin
    perform public.save_workout_set(current_date, 'bench_press', 65, 10, '20000000-0000-4000-8000-000000000001');
    raise exception 'Se permite reutilizar un identificador con datos diferentes';
  exception when invalid_parameter_value then
    null;
  end;
  perform public.save_workout_set(current_date - 1, 'bench_press', 50, 8, '20000000-0000-4000-8000-000000000002');
  previous := public.get_workout_session(current_date, 'bench_press');
  if (previous ->> 'previous_date')::date <> current_date - 1
    or (previous -> 'previous_sets' -> 0 ->> 'weight')::numeric <> 50
    or jsonb_array_length(previous -> 'sets') <> 2 then
    raise exception 'Los datos de la sesion anterior no son correctos';
  end if;
  perform public.save_workout_set(current_date - 1, 'bench_press', 50, 20, '20000000-0000-4000-8000-000000000003');
  insert into public.workout_logs (user_id, date) values (auth.uid(), current_date - 2);
  previous := public.get_profile_overview(current_date);
  if (previous -> 'summary' ->> 'days')::integer <> 2
    or (previous -> 'summary' ->> 'sets')::integer <> 4
    or (previous -> 'summary' ->> 'volume')::numeric <> 2600
    or jsonb_array_length(previous -> 'recent_days') <> 2
    or jsonb_array_length(previous -> 'activity') <> 7 then
    raise exception 'El resumen de perfil incluye dias vacios o totales incorrectos';
  end if;
  if (previous -> 'best_marks' -> 0 ->> 'weight')::numeric <> 60
    or (previous -> 'best_marks' -> 0 ->> 'reps')::integer <> 10 then
    raise exception 'La marca combina datos de series diferentes';
  end if;
end;
$$;

do $$
declare
  history jsonb := public.get_workout_history(current_date);
  empty_day jsonb := public.get_workout_history(current_date - 2);
  first_of_month boolean := extract(day from current_date) = 1;
begin
  if (history -> 'summary' ->> 'sets')::integer <> (case when first_of_month then 2 else 4 end)
    or (history -> 'summary' ->> 'days')::integer <> (case when first_of_month then 1 else 2 end)
    or (history -> 'summary' ->> 'volume')::numeric <> (case when first_of_month then 1200 else 2600 end)
    or jsonb_array_length(history -> 'sets') <> 2
    or (history ->> 'month')::date <> date_trunc('month', current_date)::date then
    raise exception 'El historial no separa el mes y las series del dia seleccionado';
  end if;
  if history -> 'sets' -> 0 ->> 'name' <> 'Press de banca'
    or (history -> 'sets' -> 0 ->> 'set_number')::integer <> 1
    or (history -> 'sets' -> 1 ->> 'set_number')::integer <> 2 then
    raise exception 'El historial pierde el ejercicio o el orden de las series';
  end if;
  if jsonb_array_length(empty_day -> 'sets') <> 0 or exists (
    select 1 from jsonb_array_elements(empty_day -> 'days') as day
    where (day ->> 'date')::date = current_date - 2
  ) then
    raise exception 'El historial marca como entrenado un dia sin series';
  end if;
end;
$$;

do $$
declare
  context jsonb := public.get_coach_context(current_date);
  quota jsonb;
begin
  if (context -> 'summary' ->> 'sets')::integer <> 4
    or (context -> 'summary' ->> 'days')::integer <> 2
    or (context -> 'summary' ->> 'volume')::numeric <> 2600
    or jsonb_array_length(context -> 'catalog') <> 48 then
    raise exception 'El contexto IA no corresponde a las series reales';
  end if;
  if (context -> 'weekly' -> 0 ->> 'weight')::numeric <> 60
    or (context -> 'weekly' -> 0 ->> 'reps')::integer <> 10 then
    raise exception 'El contexto IA combina peso y repeticiones de series distintas';
  end if;
  for request_number in 1..5 loop
    quota := public.claim_coach_request();
    if not (quota ->> 'allowed')::boolean then
      raise exception 'La cuota del dia anterior bloquea el nuevo dia';
    end if;
  end loop;
  quota := public.claim_coach_request();
  if (quota ->> 'allowed')::boolean or (quota ->> 'retry_after')::integer < 1 then
    raise exception 'No se aplica el limite de cinco intentos por minuto';
  end if;
  begin
    update public.coach_usage set requests = 1;
    raise exception 'El usuario puede reiniciar su cuota';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform * from public.coach_usage;
    raise exception 'El usuario puede leer las cuotas privadas';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
update public.coach_usage set minute_start = date_trunc('minute', now()) - interval '1 minute'
where user_id = '00000000-0000-4000-8000-000000000001' and day = (now() at time zone 'UTC')::date;
set local role authenticated;
do $$
begin
  if not (public.claim_coach_request() ->> 'allowed')::boolean then
    raise exception 'La cuota no se renueva al cambiar de minuto';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.workout_sets) <> 0 then
    raise exception 'Se filtran series de otro usuario';
  end if;
  if public.get_workout_session(current_date, 'bench_press') ->> 'previous_date' is not null then
    raise exception 'Se filtra la sesion anterior de otro usuario';
  end if;
  if (public.get_profile_overview(current_date) -> 'summary' ->> 'sets')::integer <> 0 then
    raise exception 'El perfil incluye series de otro usuario';
  end if;
  if (public.get_workout_history(current_date) -> 'summary' ->> 'sets')::integer <> 0
    or jsonb_array_length(public.get_workout_history(current_date) -> 'sets') <> 0 then
    raise exception 'El historial incluye entrenamientos de otro usuario';
  end if;
  if (public.get_coach_context(current_date) -> 'summary' ->> 'sets')::integer <> 0 then
    raise exception 'El coach incluye series de otro usuario';
  end if;
  if (public.claim_coach_request() ->> 'allowed')::boolean then
    raise exception 'Se supera el limite diario de cincuenta consultas';
  end if;
end;
$$;

set local role anon;
do $$
begin
  if (select count(*) from public.exercises_catalog) <> 48 then
    raise exception 'El catalogo no contiene los 48 ejercicios';
  end if;
  begin
    perform public.get_profile_overview(current_date);
    raise exception 'Se permite consultar el perfil sin autenticar';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.get_workout_history(current_date);
    raise exception 'Se permite consultar el historial sin autenticar';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.get_workout_recap(current_date, 'week');
    raise exception 'Se permite consultar el recap sin autenticar';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.get_coach_context(current_date);
    raise exception 'Se permite consultar el coach sin autenticar';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.claim_coach_request();
    raise exception 'Se permite reservar cuota sin autenticar';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.save_workout_set(current_date, 'bench_press', 60, 10, '20000000-0000-4000-8000-000000000003');
    raise exception 'Se permite guardar sin autenticar';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform * from public.workout_logs;
    raise exception 'Se permite leer entrenamientos sin autenticar';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.save_workout_set('2001-01-13', 'bench_press', 20, 10, '30000000-0000-4000-8000-000000000001');
select public.save_workout_set('2001-01-14', 'bench_press', 25, 10, '30000000-0000-4000-8000-000000000002');
select public.save_workout_set('2001-02-13', 'bench_press', 10, 10, '30000000-0000-4000-8000-000000000003');
select public.save_workout_set('2001-02-14', 'bench_press', 30, 10, '30000000-0000-4000-8000-000000000004');
insert into public.workout_logs (user_id, date) values (auth.uid(), '2001-02-01');

do $$
declare
  recap jsonb := public.get_workout_recap('2001-02-13', 'month');
  year_recap jsonb := public.get_workout_recap('2001-02-13', 'year');
begin
  if (recap -> 'current' ->> 'sets')::integer <> 1
    or (recap -> 'current' ->> 'days')::integer <> 1
    or (recap -> 'current' ->> 'volume')::numeric <> 100
    or (recap -> 'previous' ->> 'sets')::integer <> 1
    or (recap -> 'previous' ->> 'volume')::numeric <> 200
    or recap -> 'range' ->> 'previous_end' <> '2001-01-13' then
    raise exception 'El recap mezcla dias vacios, fechas futuras o periodos no comparables';
  end if;
  if jsonb_array_length(recap -> 'buckets') <> 13
    or (recap -> 'buckets' -> 0 ->> 'volume')::numeric <> 0
    or (recap -> 'buckets' -> 12 ->> 'volume')::numeric <> 100
    or (select sum((category ->> 'sets')::integer) from jsonb_array_elements(recap -> 'categories') as category) <> 1 then
    raise exception 'Las graficas del recap pierden ceros o duplican series por categoria';
  end if;
  if (year_recap -> 'current' ->> 'sets')::integer <> 3
    or (year_recap -> 'current' ->> 'volume')::numeric <> 550
    or jsonb_array_length(year_recap -> 'buckets') <> 2
    or (year_recap -> 'buckets' -> 0 ->> 'volume')::numeric <> 450 then
    raise exception 'El recap anual no agrupa por meses o incluye fechas posteriores al corte';
  end if;
  if public.get_workout_recap('2028-02-29', 'year') -> 'range' ->> 'previous_end' <> '2027-03-01'
    or public.get_workout_recap('2028-03-31', 'month') -> 'range' ->> 'previous_end' <> '2028-02-29'
    or public.get_workout_recap('2026-01-01', 'week') -> 'range' ->> 'current_start' <> '2025-12-29' then
    raise exception 'Los rangos SQL divergen del calendario comparable';
  end if;
  begin
    perform public.get_workout_recap('2001-02-13', 'day');
    raise exception 'El recap acepta un periodo no permitido';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare
  recap jsonb := public.get_workout_recap('2001-02-13', 'month');
begin
  if (recap -> 'current' ->> 'sets')::integer <> 0
    or (recap -> 'previous' ->> 'volume')::numeric <> 0
    or (select sum((bucket ->> 'volume')::numeric) from jsonb_array_elements(recap -> 'buckets') as bucket) <> 0
    or (select sum((category ->> 'sets')::integer) from jsonb_array_elements(recap -> 'categories') as category) <> 0 then
    raise exception 'El recap incluye datos de otro usuario';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  training_day date;
  week_number integer;
  completion jsonb;
  retry_completion jsonb;
  saved_request uuid;
begin
  foreach training_day in array array[date '2002-01-21', date '2002-01-22', date '2002-01-28', date '2002-01-29', date '2002-02-04', date '2002-02-05'] loop
    week_number := (training_day - date '2002-01-21') / 7;
    perform public.save_workout_set(training_day, 'bench_press', 60, 10, gen_random_uuid());
    perform public.save_workout_set(training_day, 'push_up', 0, 10, gen_random_uuid());
    perform public.save_workout_set(training_day, 'incline_bench_press', 30 + week_number, 10, gen_random_uuid());
    perform public.save_workout_set(training_day, 'incline_dumbbell_press', 30 - week_number, 10, gen_random_uuid());
    perform public.save_workout_set(training_day, 'cable_fly', 10, 10 + week_number, gen_random_uuid());
    if extract(isodow from training_day) = 1 then
      perform public.save_workout_set(training_day, 'dumbbell_bench_press', 30, 10, gen_random_uuid());
    end if;
    if training_day <> date '2002-02-05' then
      completion := public.finish_workout(training_day);
      if (completion ->> 'alerts_created')::integer <> 0 then
        raise exception 'El detector avisa antes de tener tres semanas con dos sesiones';
      end if;
    end if;
  end loop;
  completion := public.finish_workout('2002-02-05');
  retry_completion := public.finish_workout('2002-02-05');
  if (completion ->> 'alerts_created')::integer <> 2
    or (retry_completion ->> 'alerts_created')::integer <> 0
    or completion ->> 'completed_at' <> retry_completion ->> 'completed_at'
    or jsonb_array_length(public.get_training_alerts() -> 'alerts') <> 2 then
    raise exception 'El cierre duplica avisos o interpreta progreso, bajadas o muestras escasas como estancamiento';
  end if;
  if exists (select 1 from public.ai_alerts where exercise_id not in ('bench_press', 'push_up')) then
    raise exception 'El detector genera avisos para ejercicios que progresan o no tienen muestras suficientes';
  end if;
  select sets.client_request_id into saved_request from public.workout_sets as sets
    join public.workout_logs as logs on logs.id = sets.workout_log_id where logs.date = '2002-02-05' and sets.exercise_id = 'bench_press';
  perform public.save_workout_set('2002-02-05', 'bench_press', 60, 10, saved_request);
  if (select completed_at from public.workout_logs where date = '2002-02-05') is null
    or jsonb_array_length(public.get_training_alerts() -> 'alerts') <> 2 then
    raise exception 'El reintento de una serie existente reabre la sesion o invalida avisos';
  end if;

  foreach training_day in array array[date '2002-01-23', date '2002-01-24', date '2002-01-30', date '2002-01-31', date '2002-02-06', date '2002-02-07'] loop
    perform public.save_workout_set(training_day, 'pec_deck', 20, 10, gen_random_uuid());
  end loop;
  if (public.finish_workout('2002-02-07') ->> 'alerts_created')::integer <> 0 then
    raise exception 'El detector cuenta entrenamientos sin finalizar';
  end if;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  if jsonb_array_length(public.get_training_alerts() -> 'alerts') <> 0 then
    raise exception 'Se filtran avisos de otro usuario';
  end if;
  begin
    perform public.finish_workout('2002-01-21');
    raise exception 'Se permite finalizar el entrenamiento de otro usuario';
  exception when invalid_parameter_value then
    null;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  update public.ai_alerts set is_read = true where exercise_id = 'bench_press';
  if jsonb_array_length(public.get_training_alerts() -> 'alerts') <> 1 then
    raise exception 'El aviso leido sigue pendiente';
  end if;
  update public.workout_sets set weight = 65
  where workout_log_id = (select id from public.workout_logs where date = '2002-02-05') and exercise_id = 'bench_press';
  if (select completed_at from public.workout_logs where date = '2002-02-05') is not null
    or jsonb_array_length(public.get_training_alerts() -> 'alerts') <> 0 then
    raise exception 'Cambiar una serie no reabre la sesion o deja avisos obsoletos de sus otros ejercicios';
  end if;
  if (public.finish_workout('2002-02-05') ->> 'alerts_created')::integer <> 1 then
    raise exception 'El nuevo analisis no conserva el progreso o el aviso leido';
  end if;
  update public.workout_logs set date = '2002-02-08' where date = '2002-02-05';
  if (select completed_at from public.workout_logs where date = '2002-02-08') is not null
    or jsonb_array_length(public.get_training_alerts() -> 'alerts') <> 0 then
    raise exception 'Mover un entrenamiento conserva el cierre o avisos obsoletos';
  end if;
  perform public.finish_workout('2002-02-08');
  delete from public.workout_logs where date = '2002-02-08';
  if jsonb_array_length(public.get_training_alerts() -> 'alerts') <> 0 then
    raise exception 'Borrar un entrenamiento deja avisos obsoletos';
  end if;
  begin
    update public.workout_logs set completed_at = now();
    raise exception 'El cliente puede falsificar el cierre sin analizar';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.finish_workout('2003-01-01');
    raise exception 'Se permite finalizar un entrenamiento vacio';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.finish_workout((now() at time zone 'UTC')::date + 2);
    raise exception 'Se permite finalizar un entrenamiento futuro';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.finish_workout(current_date);
    raise exception 'Se permite finalizar sin autenticar';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.get_training_alerts();
    raise exception 'Se permite consultar avisos sin autenticar';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  ranking jsonb;
begin
  perform public.save_workout_set('2004-01-05', 'bench_press', 100, 10, gen_random_uuid());
  perform public.save_workout_set('2004-01-05', 'bench_press', 80, 20, gen_random_uuid());
  perform public.finish_workout('2004-01-05');
  ranking := public.get_rankings('bench_press', 'weight');
  if (ranking ->> 'enabled')::boolean or (ranking ->> 'total')::integer <> 0
    or (ranking -> 'personal' ->> 'weight')::numeric <> 100 or (ranking -> 'personal' ->> 'reps')::integer <> 10
    or ranking -> 'personal' ->> 'position' is not null then
    raise exception 'La participacion no es privada por defecto o la marca mezcla series';
  end if;
  ranking := public.get_rankings('bench_press', 'weight', 0, true);
  if not (ranking ->> 'enabled')::boolean or (ranking ->> 'total')::integer <> 1
    or (ranking -> 'personal' ->> 'position')::integer <> 1 then
    raise exception 'La participacion no publica la marca propia';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare
  ranking jsonb;
begin
  perform public.save_workout_set('2004-01-05', 'bench_press', 100, 25, gen_random_uuid());
  ranking := public.get_rankings('bench_press', 'weight');
  if ranking -> 'personal' <> 'null'::jsonb then
    raise exception 'Rankings incluye una sesion sin finalizar';
  end if;
  perform public.finish_workout('2004-01-05');
  ranking := public.get_rankings('bench_press', 'weight', 0, true);
  if (ranking ->> 'total')::integer <> 2
    or exists (select 1 from jsonb_array_elements(ranking -> 'entries') as entry where (entry ->> 'position')::integer <> 1)
    or exists (select 1 from jsonb_array_elements(ranking -> 'entries') as entry where entry ? 'id' or entry ? 'user_id' or entry ? 'date') then
    raise exception 'Los empates no comparten posicion o se publican datos privados';
  end if;
  ranking := public.get_rankings('bench_press', 'reps', 1);
  if jsonb_array_length(ranking -> 'entries') <> 0 or (ranking ->> 'total')::integer <> 2
    or (ranking -> 'personal' ->> 'position')::integer <> 1 then
    raise exception 'La paginacion pierde el total o la posicion propia';
  end if;
  begin
    perform public.get_rankings('bench_press', 'volume');
    raise exception 'Rankings acepta metricas no permitidas';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  ranking jsonb := public.get_rankings('bench_press', 'reps');
begin
  if (ranking -> 'personal' ->> 'weight')::numeric <> 80 or (ranking -> 'personal' ->> 'reps')::integer <> 20
    or (ranking -> 'personal' ->> 'position')::integer <> 2 then
    raise exception 'La mejor marca por repeticiones no corresponde a una serie real';
  end if;
  ranking := public.get_rankings('bench_press', 'weight', 0, false);
  if (ranking ->> 'enabled')::boolean or (ranking ->> 'total')::integer <> 1
    or ranking -> 'personal' ->> 'position' is not null
    or (ranking -> 'entries' -> 0 ->> 'is_me')::boolean then
    raise exception 'La retirada no elimina al propietario de la clasificacion';
  end if;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.get_rankings('bench_press', 'weight');
    raise exception 'Rankings permite consultar sin autenticar';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
-- ---------------------------------------------------------------------------
-- Cardio (fase 1): aislamiento, permisos de columna, restricciones y convivencia
-- con las funciones de fuerza. Usa fechas de 2003 para no mezclarse con los datos anteriores.
-- ---------------------------------------------------------------------------
insert into public.workout_logs (id, user_id, date) values
  ('10000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', '2003-03-03'),
  ('10000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', '2003-03-04');
insert into public.workout_sets (workout_log_id, exercise_id, set_number, weight, reps)
values ('10000000-0000-4000-8000-0000000000c2', 'bench_press', 1, 50, 5);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Las funciones de fuerza devuelven exactamente lo mismo antes y después de añadir cardio.
do $$
declare
  history_before jsonb := public.get_workout_history(current_date);
  recap_before jsonb := public.get_workout_recap(current_date, 'month');
  profile_before jsonb := public.get_profile_overview(current_date);
  coach_before jsonb := public.get_coach_context(current_date);
  session_before jsonb := public.get_workout_session(current_date, 'bench_press');
begin
  insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds, distance_km, avg_hr, max_hr, calories, rpe, client_request_id)
  values ('10000000-0000-4000-8000-000000000001', 'running', 1800, 5.2, 150, 172, 420, 7, '20000000-0000-4000-8000-000000000001');
  insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds)
  values ('10000000-0000-4000-8000-0000000000c1', 'swimming', 2400);
  insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds, data_source)
  values ('10000000-0000-4000-8000-0000000000c2', 'rowing', 900, 'estimated');

  if public.get_workout_history(current_date) is distinct from history_before then
    raise exception 'El historial cambia al añadir cardio';
  end if;
  if public.get_workout_recap(current_date, 'month') is distinct from recap_before then
    raise exception 'El recap cambia al añadir cardio';
  end if;
  if public.get_profile_overview(current_date) is distinct from profile_before then
    raise exception 'El perfil cambia al añadir cardio';
  end if;
  if public.get_coach_context(current_date) is distinct from coach_before then
    raise exception 'El contexto IA cambia al añadir cardio';
  end if;
  if public.get_workout_session(current_date, 'bench_press') is distinct from session_before then
    raise exception 'La sesión de fuerza cambia al añadir cardio';
  end if;
end;
$$;

-- Un día solo de cardio (log sin series) no cuenta como día entrenado ni se puede finalizar.
do $$
declare
  march jsonb := public.get_workout_history('2003-03-03');
begin
  if jsonb_array_length(march -> 'sets') <> 0 or exists (
    select 1 from jsonb_array_elements(march -> 'days') as day where (day ->> 'date')::date = '2003-03-03'
  ) then
    raise exception 'Un día solo de cardio aparece como día de fuerza en el historial';
  end if;
  if (public.get_workout_recap('2003-03-03', 'week') -> 'current' ->> 'sets')::integer <> 0 then
    raise exception 'El recap cuenta series en un día solo de cardio';
  end if;
  begin
    perform public.finish_workout('2003-03-03');
    raise exception 'Se puede finalizar un día solo de cardio';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

-- Restricciones de datos y permisos de columna.
do $$
begin
  if (select count(*) from public.cardio_sessions) <> 3 then
    raise exception 'El propietario no ve sus tres sesiones de cardio';
  end if;
  begin
    insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds)
    values ('10000000-0000-4000-8000-000000000001', 'parkour', 600);
    raise exception 'Se permite una actividad fuera del catálogo';
  exception when check_violation then null;
  end;
  begin
    insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds)
    values ('10000000-0000-4000-8000-000000000001', 'running', 0);
    raise exception 'Se permite una duración nula';
  exception when check_violation then null;
  end;
  begin
    insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds, avg_hr, max_hr)
    values ('10000000-0000-4000-8000-000000000001', 'running', 600, 170, 150);
    raise exception 'Se permite una FC máxima inferior a la media';
  exception when check_violation then null;
  end;
  begin
    insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds, rpe)
    values ('10000000-0000-4000-8000-000000000001', 'running', 600, 11);
    raise exception 'Se permite un RPE fuera de 1 a 10';
  exception when check_violation then null;
  end;
  begin
    insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds, data_source)
    values ('10000000-0000-4000-8000-000000000001', 'running', 600, 'sensor');
    raise exception 'Un cliente puede falsificar el origen sensor';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.cardio_sessions set data_source = 'sensor';
    raise exception 'Un cliente puede cambiar una sesión a origen sensor';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds, client_request_id)
    values ('10000000-0000-4000-8000-000000000001', 'running', 1800, '20000000-0000-4000-8000-000000000001');
    raise exception 'Se duplica una petición con el mismo identificador';
  exception when unique_violation then null;
  end;
  begin
    insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds)
    values ('10000000-0000-4000-8000-000000000002', 'running', 600);
    raise exception 'Se permite escribir cardio en el entrenamiento de otro usuario';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.cardio_sessions set workout_log_id = '10000000-0000-4000-8000-000000000002';
    raise exception 'Se permite mover una sesión a otro entrenamiento';
  exception when insufficient_privilege then null;
  end;
  update public.cardio_sessions set duration_seconds = 1900, rpe = 8
  where workout_log_id = '10000000-0000-4000-8000-000000000001';
  if (select duration_seconds from public.cardio_sessions where workout_log_id = '10000000-0000-4000-8000-000000000001') <> 1900 then
    raise exception 'El propietario no puede editar su sesión';
  end if;
end;
$$;

-- Otro usuario no ve ni borra nada ajeno.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare
  removed integer;
begin
  if (select count(*) from public.cardio_sessions) <> 0 then
    raise exception 'Se filtran sesiones de cardio ajenas';
  end if;
  delete from public.cardio_sessions;
  get diagnostics removed = row_count;
  if removed <> 0 then
    raise exception 'Se pueden borrar sesiones de cardio ajenas';
  end if;
end;
$$;

-- Sin sesión no hay acceso.
set local role anon;
do $$
begin
  begin
    perform count(*) from public.cardio_sessions;
    raise exception 'anon puede leer el cardio';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- La finalización automática finaliza el día con series (aunque tenga cardio) y deja intacto el solo-cardio.
do $$
begin
  perform public.auto_finish_past_workouts();
  if (select completed_at from public.workout_logs where id = '10000000-0000-4000-8000-0000000000c2') is null then
    raise exception 'La finalización automática no cierra un día con series y cardio';
  end if;
  if (select completed_at from public.workout_logs where id = '10000000-0000-4000-8000-0000000000c1') is not null then
    raise exception 'La finalización automática cierra un día solo de cardio';
  end if;
end;
$$;

-- Añadir cardio a un día ya finalizado no lo reabre; borrar el entrenamiento borra su cardio.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  insert into public.cardio_sessions (workout_log_id, activity_type, duration_seconds)
  values ('10000000-0000-4000-8000-0000000000c2', 'walking', 600);
  if (select completed_at from public.workout_logs where id = '10000000-0000-4000-8000-0000000000c2') is null then
    raise exception 'Añadir cardio reabre un entrenamiento finalizado';
  end if;
  delete from public.workout_logs where id = '10000000-0000-4000-8000-0000000000c1';
  if exists (select 1 from public.cardio_sessions where workout_log_id = '10000000-0000-4000-8000-0000000000c1') then
    raise exception 'Borrar el entrenamiento no borra su cardio';
  end if;
end;
$$;
reset role;

-- Fase 2: save_cardio_session y get_recent_cardio.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  log_day constant date := '2004-04-04';
  request_id constant uuid := '30000000-0000-4000-8000-000000000001';
  first_save public.cardio_sessions;
  second_save public.cardio_sessions;
  recent jsonb;
begin
  first_save := public.save_cardio_session(log_day, 'running', 1800, 5, 150, 175, 400, 'manual', 7, request_id);
  second_save := public.save_cardio_session(log_day, 'running', 1800, 5, 150, 175, 400, 'manual', 7, request_id);
  if first_save.id <> second_save.id
    or (select count(*) from public.cardio_sessions where client_request_id = request_id) <> 1 then
    raise exception 'Reintentar un guardado de cardio lo duplica';
  end if;
  if (select count(*) from public.workout_logs where user_id = '00000000-0000-4000-8000-000000000001' and date = log_day) <> 1 then
    raise exception 'Guardar cardio no crea (o duplica) el log del día';
  end if;

  -- Reutilizar el mismo requestId con otros datos se rechaza.
  begin
    perform public.save_cardio_session(log_day, 'running', 1801, 5, 150, 175, 400, 'manual', 7, request_id);
    raise exception 'Se acepta un requestId reutilizado con otros datos';
  exception when sqlstate '22023' then null;
  end;

  -- Datos inválidos: actividad fuera del catálogo, sensor, estimación sin calorías, FC incoherente, duración 0.
  begin
    perform public.save_cardio_session(log_day, 'skiing', 600, null, null, null, null, 'manual', null, gen_random_uuid());
    raise exception 'Se acepta una actividad fuera del catálogo';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_cardio_session(log_day, 'running', 600, null, null, null, 100, 'sensor', null, gen_random_uuid());
    raise exception 'Un cliente puede guardar data_source = sensor';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_cardio_session(log_day, 'running', 600, null, null, null, null, 'estimated', null, gen_random_uuid());
    raise exception 'Se acepta una estimación sin calorías';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_cardio_session(log_day, 'running', 600, null, 160, 150, null, 'manual', null, gen_random_uuid());
    raise exception 'Se acepta una FC máxima menor que la media';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_cardio_session(log_day, 'running', 0, null, null, null, null, 'manual', null, gen_random_uuid());
    raise exception 'Se acepta una duración de 0 segundos';
  exception when sqlstate '22023' then null;
  end;

  -- El listado incluye la sesión con la fecha del log y respeta el límite.
  recent := public.get_recent_cardio(100);
  if not exists (
    select 1 from jsonb_array_elements(recent) as item
    where item ->> 'id' = first_save.id::text and item ->> 'date' = log_day::text and item ->> 'activity_type' = 'running'
  ) then
    raise exception 'get_recent_cardio no devuelve la sesión con su fecha';
  end if;
  if jsonb_array_length(public.get_recent_cardio(1)) <> 1 or jsonb_array_length(public.get_recent_cardio(0)) <> 1 then
    raise exception 'get_recent_cardio no respeta el límite';
  end if;

  -- Un día solo de cardio no cambia el historial de fuerza (el calendario se amplía en la Fase 4).
  if jsonb_array_length(public.get_workout_history(log_day) -> 'days') <> 0
    or jsonb_array_length(public.get_workout_history(log_day) -> 'sets') <> 0 then
    raise exception 'Un día solo de cardio altera el historial de fuerza';
  end if;
end;
$$;

-- Otro usuario no ve esa sesión y puede reutilizar el mismo requestId en su propio log.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare
  other public.cardio_sessions;
begin
  if exists (select 1 from jsonb_array_elements(public.get_recent_cardio(100)) as item where item ->> 'date' = '2004-04-04') then
    raise exception 'get_recent_cardio filtra cardio de otro usuario';
  end if;
  other := public.save_cardio_session('2004-04-04', 'walking', 900, null, null, null, null, 'manual', null, '30000000-0000-4000-8000-000000000001');
  if not exists (select 1 from public.workout_logs where id = other.workout_log_id and user_id = '00000000-0000-4000-8000-000000000002') then
    raise exception 'Un usuario cuelga cardio del log de otro';
  end if;
end;
$$;

-- Sin sesión no se ejecutan.
set local role anon;
do $$
begin
  begin
    perform public.get_recent_cardio(10);
    raise exception 'anon puede leer el cardio con get_recent_cardio';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_cardio_session('2004-04-04', 'running', 600, null, null, null, null, 'manual', null, gen_random_uuid());
    raise exception 'anon puede guardar cardio';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
