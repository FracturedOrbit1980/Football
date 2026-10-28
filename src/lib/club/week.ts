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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function isCalendarIso(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Day, month, year. Example: 28/10/2026. Unknown text is returned unchanged. */
export function formatDate(iso: string) {
  if (!isCalendarIso(iso)) return iso;
  const [, , month, day] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  const year = iso.slice(0, 4);
  return `${day}/${month}/${year}`;
}

/** Weekday plus dd/mm/yyyy. Example: Wed 28/10/2026. */
export function formatDay(iso: string) {
  if (!isCalendarIso(iso)) return iso;
  return `${WEEKDAYS[parseIso(iso).getDay()]} ${formatDate(iso)}`;
}

/** Parse a dd/mm/yyyy (or dd-mm-yyyy) date into yyyy-mm-dd. */
export function parseDisplayDate(value: string) {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isCalendarIso(iso) ? iso : null;
}
