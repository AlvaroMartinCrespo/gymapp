export function getRecapRange(date, period) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < "2000-01-01" || date > "2100-12-31" || !["week", "month", "year"].includes(period)) {
    throw new RangeError("Invalid recap period");
  }
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const current = period === "week"
    ? new Date(parsed.getTime() - ((parsed.getUTCDay() + 6) % 7) * 86400000)
    : new Date(Date.UTC(year, period === "year" ? 0 : month, 1));
  const previous = period === "week" ? new Date(current.getTime() - 7 * 86400000)
    : new Date(Date.UTC(period === "year" ? year - 1 : year, period === "year" ? 0 : month - 1, 1));
  const previousEnd = new Date(Math.min(current.getTime() - 86400000, previous.getTime() + parsed.getTime() - current.getTime()));
  return {
    current_start: current.toISOString().slice(0, 10), current_end: date,
    previous_start: previous.toISOString().slice(0, 10), previous_end: previousEnd.toISOString().slice(0, 10),
  };
}

export function recapChange(current, previous) {
  if (![current, previous].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) throw new RangeError("Invalid recap values");
  return { difference: current - previous, percent: previous === 0 ? null : ((current - previous) / previous) * 100 };
}