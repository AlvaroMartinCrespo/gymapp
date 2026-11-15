import exercises from "@/db/exercises.json";
import { ExerciseSearch } from "./exercise-search";

const categories = [...new Set(exercises.map((exercise) => exercise.category))];

type ExercisePickerProps = {
  exerciseId: string;
  disabled: boolean;
  onChange: (exerciseId: string) => void;
};

/** Grupo muscular (chips) y ejercicio (buscador con favoritos y recientes). */
export function ExercisePicker({ exerciseId, disabled, onChange }: ExercisePickerProps) {
  const exercise = exercises.find((candidate) => candidate.id === exerciseId) ?? exercises[0];
  return (
    <div className="space-y-5">
      <fieldset disabled={disabled}>
        <legend className="mb-3 text-sm font-medium">Grupo muscular</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label key={category} className="relative cursor-pointer">
              <input type="radio" name="muscle-group" checked={exercise.category === category} onChange={() => onChange(exercises.find((candidate) => candidate.category === category)!.id)} className="peer sr-only" />
              <span className="flex min-h-10 items-center rounded-full border border-border px-3 text-sm peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50">{category}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <ExerciseSearch exerciseId={exercise.id} disabled={disabled} onChange={onChange} />
    </div>
  );
}
