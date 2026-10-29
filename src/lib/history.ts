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