type DaySet = { id: string; exercise_id: string; name: string; set_number: number; weight: number | string; reps: number };

export function summarizeWorkoutDay(sets: DaySet[]) {
  const exercises = new Map<string, { id: string; name: string; sets: DaySet[] }>();
  let volume = 0;
  let repetitions = 0;
  for (const entry of sets) {
    let exercise = exercises.get(entry.exercise_id);
    if (!exercise) {
      exercise = { id: entry.exercise_id, name: entry.name, sets: [] };
      exercises.set(entry.exercise_id, exercise);
    }
    exercise.sets.push(entry);
    volume += Number(entry.weight) * entry.reps;
    repetitions += entry.reps;
  }
  for (const exercise of exercises.values()) exercise.sets.sort((first, second) => first.set_number - second.set_number);
  return { exercises: [...exercises.values()], sets: sets.length, repetitions, volume };
}

export function localHistoryDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < "2000-01-01" || date > "2100-12-31") {
    throw new RangeError("Invalid history date");
  }
  return parsed;
}

export function calendarCells(date: string): (string | null)[] {
  const parsed = parseDate(date);
  const first = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1;
    return day >= 1 && day <= days ? `${date.slice(0, 7)}-${String(day).padStart(2, "0")}` : null;
  });
}

export function shiftHistoryMonth(date: string, direction: -1 | 1): string | null {
  const parsed = parseDate(date);
  const shifted = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + direction, 1)).toISOString().slice(0, 10);
  return shifted < "2000-01-01" || shifted > "2100-12-31" ? null : shifted;
}