-- Programa la finalización automática de entrenamientos (cada hora, en el minuto 5).
-- Requisitos:
--   1) Haber aplicado supabase/migrations/20261030000000_auto_finish_workouts.sql.
--   2) Activar pg_cron en Supabase: Database > Extensions > pg_cron.
-- Ejecutar a mano en el SQL Editor. Repetirlo no duplica la tarea: sustituye la del mismo nombre.

select cron.schedule(
  'auto-finish-workouts',
  '5 * * * *',
  $$select public.auto_finish_past_workouts()$$
);

-- Primera pasada manual (finaliza los días pasados pendientes ahora mismo).
-- Devuelve cuántos finalizó; si devuelve 500, repetir hasta que baje.
-- select public.auto_finish_past_workouts();

-- Comprobar que la tarea existe y cómo han ido las últimas ejecuciones:
-- select jobid, jobname, schedule, active from cron.job;
-- select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;

-- Para desactivarla:
-- select cron.unschedule('auto-finish-workouts');
