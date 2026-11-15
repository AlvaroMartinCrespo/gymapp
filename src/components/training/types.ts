export type WorkoutSet = { id: string; set_number: number; weight: number | string; reps: number; is_pr?: boolean };
export type DaySet = WorkoutSet & { exercise_id: string; name: string };
/** Peso y repeticiones de una serie, para precargar el formulario. */
export type SetValues = { weight: number | string; reps: number };

/** Prefijo del id de una serie guardada de forma optimista que el servidor aún no ha confirmado. */
export const PENDING_PREFIX = "pending:";
