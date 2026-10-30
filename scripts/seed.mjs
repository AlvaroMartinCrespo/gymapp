import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const exercises = JSON.parse(
  readFileSync(new URL("../src/db/exercises.json", import.meta.url), "utf8"),
);
const categories = ["Pecho", "Espalda", "Piernas", "Hombros", "Bíceps", "Tríceps", "Core"];

export function createSeedSql(catalog = exercises) {
  const identifiers = new Set();
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error("El catálogo no puede estar vacío.");
  }
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  const rows = catalog.map((exercise) => {
    if (
      !exercise ||
      typeof exercise.id !== "string" ||
      !/^[a-z][a-z0-9_]*$/.test(exercise.id) ||
      identifiers.has(exercise.id) ||
      typeof exercise.name !== "string" ||
      !exercise.name.trim() ||
      !categories.includes(exercise.category) ||
      !["front", "back"].includes(exercise.defaultCamera) ||
      !Array.isArray(exercise.primaryMeshes) ||
      exercise.primaryMeshes.length === 0 ||
      !Array.isArray(exercise.secondaryMeshes)
    ) {
      throw new Error(`Ejercicio inválido o duplicado: ${exercise?.id ?? "sin id"}`);
    }
    const meshes = [...exercise.primaryMeshes, ...exercise.secondaryMeshes];
    if (
      meshes.some((mesh) => typeof mesh !== "string" || !/^[a-z][a-z0-9_]*$/.test(mesh)) ||
      new Set(meshes).size !== meshes.length
    ) {
      throw new Error(`Mallas inválidas o duplicadas: ${exercise.id}`);
    }
    identifiers.add(exercise.id);
    return `(${[
      exercise.id,
      exercise.name,
      exercise.category,
      JSON.stringify(exercise.primaryMeshes),
      JSON.stringify(exercise.secondaryMeshes),
      exercise.defaultCamera,
    ].map(quote).join(", ")})`;
  });
  return `INSERT INTO exercises_catalog (id, name, category, primary_meshes, secondary_meshes, default_camera)
VALUES ${rows.join(",\n")}
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  category = excluded.category,
  primary_meshes = excluded.primary_meshes,
  secondary_meshes = excluded.secondary_meshes,
  default_camera = excluded.default_camera;\n`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--sql", "--write"].includes(args[0])) {
    throw new Error("Uso: node scripts/seed.mjs --sql | --write");
  }
  const sql = createSeedSql();
  if (args[0] === "--sql") {
    process.stdout.write(sql);
    return;
  }
  mkdirSync(new URL("../supabase/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
  console.log("Catálogo generado en supabase/seed.sql (45 ejercicios). No se ha modificado ninguna base de datos.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}