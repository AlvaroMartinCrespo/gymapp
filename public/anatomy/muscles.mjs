// Shared by the isolated WebGL viewer, React and the model contract tests.
export const muscleGroups = {
  pectoralis_major: "Pecho", latissimus_dorsi: "Dorsales", trapezius: "Trapecios",
  rhomboids: "Romboides", erector_spinae: "Erectores espinales", quadriceps: "Cuádriceps",
  hamstrings: "Isquiotibiales", gluteus_maximus: "Glúteo mayor", gastrocnemius: "Gemelos", soleus: "Sóleo",
  adductors: "Aductores", anterior_deltoid: "Deltoides anterior",
  lateral_deltoid: "Deltoides lateral", posterior_deltoid: "Deltoides posterior",
  biceps: "Bíceps", triceps: "Tríceps", forearms: "Antebrazos",
  rectus_abdominis: "Recto abdominal", obliques: "Oblicuos", iliopsoas: "Iliopsoas",
  infraspinatus: "Infraespinoso", brachialis: "Braquial", brachioradialis: "Braquiorradial",
};

/** @type {[RegExp, string][]} */
const rules = [
  [/pectoralis major/, "pectoralis_major"],
  [/latissimus dorsi/, "latissimus_dorsi"],
  [/trapezius/, "trapezius"],
  [/rhomboid (major|minor)/, "rhomboids"],
  [/(iliocostalis|longissimus|multifidus) (lumborum|thoracis)|spinalis thoracis/, "erector_spinae"],
  [/rectus femoris|vastus (lateralis|medialis|intermedius)/, "quadriceps"],
  [/biceps femoris|semimembranosus|semitendinosus/, "hamstrings"],
  [/gluteus maximus/, "gluteus_maximus"],
  [/gastrocnemius/, "gastrocnemius"],
  [/\bsoleus\b/, "soleus"],
  [/adductor (longus|brevis|magnus)|gracilis|pectineus/, "adductors"],
  [/clavicular part of (left|right) deltoid/, "anterior_deltoid"],
  [/acromial part of (left|right) deltoid/, "lateral_deltoid"],
  [/spinal part of (left|right) deltoid/, "posterior_deltoid"],
  [/biceps brachii/, "biceps"],
  [/\bbrachialis\b/, "brachialis"],
  [/brachioradialis/, "brachioradialis"],
  [/triceps brachii|anconeus/, "triceps"],
  [/((extensor|flexor) (carpi|digitorum|pollicis|digiti minimi))|pronator (teres|quadratus)|supinator|palmaris longus/, "forearms"],
  [/rectus abdominis/, "rectus_abdominis"],
  [/(external|internal) oblique/, "obliques"],
  [/iliacus|psoas (major|minor)/, "iliopsoas"],
  [/infraspinatus/, "infraspinatus"],
];

/** @param {string} name */
export function muscleForName(name) {
  const normalized = name.toLowerCase().replaceAll("_", " ");
  // Do not classify foot flexors/extensors as forearm muscles.
  if (/digitorum (longus|brevis)|hallucis/.test(normalized)) return null;
  return rules.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

/** @param {unknown} value */
export function validMuscles(value) {
  return Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === "string" && Object.hasOwn(muscleGroups, id)))] : [];
}

/** @param {unknown} value */
export function validHeat(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => row && Object.hasOwn(muscleGroups, row.mesh) &&
    Number.isSafeInteger(row.primary_sets) && row.primary_sets >= 0 &&
    Number.isSafeInteger(row.secondary_sets) && row.secondary_sets >= 0);
}

/** Secondary series are shown separately, never counted as full primary series.
 * @param {string} group
 * @param {{primary?: string[], secondary?: string[], heat?: {mesh: string, primary_sets: number, secondary_sets: number}[], mode?: string}} state
 */
export function muscleAppearance(group, state) {
  if (state.mode === "heat") {
    const heat = validHeat(state.heat);
    const current = heat.find((row) => row.mesh === group);
    const maximum = Math.max(1, ...heat.map((row) => row.primary_sets));
    if (current?.primary_sets) return { color: "#ef4444", intensity: 0.25 + 0.75 * current.primary_sets / maximum, active: true };
    if (current?.secondary_sets) return { color: "#991b1b", intensity: 0.35, active: true };
  } else {
    if (validMuscles(state.primary).includes(group)) return { color: "#ef4444", intensity: 1, active: true };
    if (validMuscles(state.secondary).includes(group)) return { color: "#991b1b", intensity: 0.5, active: true };
  }
  return { color: "#27272a", intensity: 0, active: false };
}