// Utilidades de cardio compartidas por la API (servidor) y el formulario (cliente).
// Son funciones puras: no tocan red ni almacenamiento.

// Catálogo cerrado (debe coincidir con el CHECK de cardio_sessions.activity_type y con
// CARDIO_ACTIVITIES de src/db/schema.ts). El orden es el del selector.
export const CARDIO_ACTIVITY_OPTIONS = [
  { id: "running", label: "Correr" },
  { id: "walking", label: "Caminar" },
  { id: "treadmill", label: "Cinta" },
  { id: "stationary_bike", label: "Bici estática" },
  { id: "elliptical", label: "Elíptica" },
  { id: "rowing", label: "Remo" },
  { id: "jump_rope", label: "Comba" },
  { id: "swimming", label: "Natación" },
];

export const CARDIO_ACTIVITY_IDS = CARDIO_ACTIVITY_OPTIONS.map((option) => option.id);

/** @param {string} id */
export function cardioActivityLabel(id) {
  return CARDIO_ACTIVITY_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

// La app todavía no guarda el peso corporal: la estimación usa este valor y se marca como
// "estimated" para que nadie la confunda con un dato medido.
export const DEFAULT_BODY_WEIGHT_KG = 70;

// MET aproximados del Compendium of Physical Activities. Sin distancia se usa un valor medio.
const DEFAULT_MET = {
  running: 9,
  walking: 3.5,
  treadmill: 6,
  stationary_bike: 7,
  elliptical: 5,
  rowing: 7,
  jump_rope: 11,
  swimming: 6,
};
// [velocidad km/h, MET]; se interpola linealmente y se satura en los extremos.
const RUNNING_MET = [[6.4, 6], [8, 8.3], [9.7, 9.8], [11.3, 11], [12.9, 12.8], [14.5, 14.5]];
const WALKING_MET = [[3.2, 2.8], [4, 3], [4.8, 3.3], [5.6, 3.8], [6.4, 5]];

function interpolate(table, speed) {
  if (speed <= table[0][0]) return table[0][1];
  for (let index = 1; index < table.length; index += 1) {
    const [x1, y1] = table[index];
    if (speed <= x1) {
      const [x0, y0] = table[index - 1];
      return y0 + ((y1 - y0) * (speed - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

function metFor(activityType, durationSeconds, distanceKm) {
  const speed = distanceKm ? distanceKm / (durationSeconds / 3600) : null;
  if (speed && activityType === "running") return interpolate(RUNNING_MET, speed);
  if (speed && activityType === "walking") return interpolate(WALKING_MET, speed);
  if (speed && activityType === "treadmill") return interpolate(speed >= 7 ? RUNNING_MET : WALKING_MET, speed);
  return DEFAULT_MET[activityType];
}

/**
 * Estimación de calorías: MET × peso (kg) × horas. Devuelve un entero o null si los datos no valen.
 * Es una aproximación orientativa, no una medición.
 * @param {{ activityType: string, durationSeconds: number, distanceKm?: number | null, weightKg?: number }} input
 * @returns {number | null}
 */
export function estimateCalories({ activityType, durationSeconds, distanceKm = null, weightKg = DEFAULT_BODY_WEIGHT_KG }) {
  if (!Object.hasOwn(DEFAULT_MET, activityType)) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 86400) return null;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  const distance = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : null;
  return Math.round(metFor(activityType, durationSeconds, distance) * weightKg * (durationSeconds / 3600));
}

const isInteger = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const optional = (value) => value === null || value === undefined;

/**
 * Valida los campos de una sesión (mismos límites que las restricciones de la base de datos).
 * @param {any} fields
 * @returns {boolean}
 */
export function validCardioFields(fields) {
  if (!fields || typeof fields !== "object") return false;
  const { activityType, durationSeconds, distanceKm, avgHr, maxHr, calories, rpe } = fields;
  if (typeof activityType !== "string" || !CARDIO_ACTIVITY_IDS.includes(activityType)) return false;
  if (!isInteger(durationSeconds, 1, 86400)) return false;
  if (!optional(distanceKm) && !(typeof distanceKm === "number" && Number.isFinite(distanceKm) && distanceKm > 0 && distanceKm <= 1000 &&
    Math.abs(distanceKm * 1000 - Math.round(distanceKm * 1000)) < 0.000001)) return false;
  if (!optional(avgHr) && !isInteger(avgHr, 30, 250)) return false;
  if (!optional(maxHr) && !isInteger(maxHr, 30, 250)) return false;
  if (!optional(avgHr) && !optional(maxHr) && maxHr < avgHr) return false;
  if (!optional(calories) && !isInteger(calories, 0, 20000)) return false;
  if (!optional(rpe) && !isInteger(rpe, 1, 10)) return false;
  return true;
}

/**
 * "45 min", "1 h 05 min", "0 min 30 s".
 * @param {number | string} seconds
 * @returns {string}
 */
export function formatCardioDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}
