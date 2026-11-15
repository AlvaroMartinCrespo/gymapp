"use client";

import { useState } from "react";
import { ChevronDown, Search, Star } from "lucide-react";

import exercises from "@/db/exercises.json";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { pushRecent, toggleFavorite, useExercisePrefs } from "./exercise-prefs";

type Exercise = (typeof exercises)[number];

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
const categories = [...new Set(exercises.map((exercise) => exercise.category))];

type ExerciseSearchProps = { exerciseId: string; disabled: boolean; onChange: (exerciseId: string) => void };

/** Selector de ejercicio con búsqueda, favoritos y recientes (sustituye al <select> nativo). */
export function ExerciseSearch({ exerciseId, disabled, onChange }: ExerciseSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { favorites, recents } = useExercisePrefs();
  const current = byId.get(exerciseId) ?? exercises[0];
  const search = normalize(query);

  const matches = search ? exercises.filter((exercise) => normalize(`${exercise.name} ${exercise.category}`).includes(search)) : null;
  const favoriteList = favorites.map((id) => byId.get(id)).filter((exercise): exercise is Exercise => Boolean(exercise));
  const recentList = recents.map((id) => byId.get(id)).filter((exercise): exercise is Exercise => Boolean(exercise) && !favorites.includes(exercise!.id));

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(id: string) {
    pushRecent(id);
    if (id !== exerciseId) onChange(id);
    close();
  }

  function row(exercise: Exercise) {
    const favorite = favorites.includes(exercise.id);
    return (
      <li key={exercise.id} className="flex items-center">
        <button type="button" aria-current={exercise.id === exerciseId ? "true" : undefined} onClick={() => choose(exercise.id)} className={cn("flex min-h-12 min-w-0 flex-1 items-center rounded-xl px-3 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring", exercise.id === exerciseId && "font-medium text-primary")}>
          <span className="min-w-0 break-words">{exercise.name}</span>
        </button>
        <button type="button" aria-pressed={favorite} title={favorite ? "Quitar de favoritos" : "Añadir a favoritos"} aria-label={`${favorite ? "Quitar de favoritos" : "Añadir a favoritos"}: ${exercise.name}`} onClick={() => toggleFavorite(exercise.id)} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
          <Star className={cn("size-4", favorite && "fill-gold text-gold")} />
        </button>
      </li>
    );
  }

  function group(title: string, list: Exercise[]) {
    if (list.length === 0) return null;
    return (
      <section key={title} aria-label={title}>
        <h3 className="type-label px-3 pb-1 pt-3 text-muted-foreground">{title}</h3>
        <ul>{list.map(row)}</ul>
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor="exercise">Ejercicio</Label>
      <button
        id="exercise"
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-input bg-card px-3 text-left text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 truncate">{current.name}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <Sheet open={open} onOpenChange={(next) => { if (!next) close(); }} title="Elegir ejercicio">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label="Buscar ejercicio" placeholder="Buscar por nombre o grupo" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" />
        </div>
        <div className="-mx-2 max-h-[55dvh] overflow-y-auto overscroll-contain" aria-live="polite">
          {matches ? (
            matches.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">Ningún ejercicio coincide con «{query.trim()}».</p> : <ul>{matches.map(row)}</ul>
          ) : (
            <>
              {group("Favoritos", favoriteList)}
              {group("Recientes", recentList)}
              {categories.map((category) => group(category, exercises.filter((exercise) => exercise.category === category)))}
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}
