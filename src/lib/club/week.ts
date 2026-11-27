const SESSION_TODAY = isoFromDate(new Date());

function isoFromDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function sessionToday() {
  return SESSION_TODAY;
}

export function parseIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: string, days: number) {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return isoFromDate(date);
}

export function mondayOf(iso: string) {
  const day = parseIso(iso).getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(iso, diff);
}

export function weekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Old records can contain a display label without a year. Keep it as entered.
export function formatDate(value: string, includeWeekday = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return value;
  const [year, month, day] = value.split("-");
  const label = `${day}/${month}/${year}`;
  return includeWeekday ? `${weekdays[date.getUTCDay()]} ${label}` : label;
}

export function formatDay(iso: string) {
  return formatDate(iso, true);
}
