/** Formato de fechas y números en español, en un solo sitio. */

export const LOCALE = "es-ES";

const DATE_STYLES = {
  /** 5 nov */
  day: { day: "numeric", month: "short" },
  /** 5 nov 2026 */
  dayYear: { day: "numeric", month: "short", year: "numeric" },
  /** 5 de noviembre de 2026 */
  full: { day: "numeric", month: "long", year: "numeric" },
  /** noviembre de 2026 */
  monthYear: { month: "long", year: "numeric" },
  /** nov */
  month: { month: "short" },
  /** jue */
  weekday: { weekday: "short" },
  /** jue, 5 nov */
  weekdayDay: { weekday: "short", day: "numeric", month: "short" },
  /** jueves, 5 de noviembre */
  weekdayFull: { weekday: "long", day: "numeric", month: "long" },
  /** 05/11/2026 */
  numeric: {},
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof DATE_STYLES;

/**
 * Formatea una fecha `AAAA-MM-DD` (a mediodía, para que la zona horaria no cambie el día) o una marca de
 * tiempo ISO completa.
 */
export function formatDate(value: string, style: DateStyle = "dayYear") {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString(LOCALE, DATE_STYLES[style]);
}

/** "Hoy" para la fecha de hoy; el año solo aparece si no es el actual. */
export function formatRelativeDate(date: string, today: string) {
  if (date === today) return "Hoy";
  const sameYear = !today || date.slice(0, 4) === today.slice(0, 4);
  return formatDate(date, sameYear ? "day" : "dayYear");
}

type NumberOptions = {
  /** Muestra siempre el signo salvo en el cero (+3, -2). */
  signed?: boolean;
  /** Notación compacta (12,3 mil). */
  compact?: boolean;
  /** Decimales máximos (2 por defecto; 1 en notación compacta). */
  decimals?: number;
};

export function formatNumber(value: number | string, { signed = false, compact = false, decimals = 2 }: NumberOptions = {}) {
  return Number(value).toLocaleString(LOCALE, {
    maximumFractionDigits: compact ? 1 : decimals,
    notation: compact ? "compact" : "standard",
    signDisplay: signed ? "exceptZero" : "auto",
  });
}
