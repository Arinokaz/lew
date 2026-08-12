const DAY_MS = 24 * 60 * 60 * 1000;

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function daysBetween(a, b) {
  const ms = startOfDay(b) - startOfDay(a);
  return Math.round(ms / DAY_MS);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a, b) {
  return todayKey(a) === todayKey(b);
}

export function isYesterday(date) {
  return daysBetween(date, new Date()) === 1;
}

export function formatDate(date) {
  return todayKey(date);
}

export function formatDateLong(date, locale = "ru") {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function minutesAgo(timestamp) {
  return Math.floor((Date.now() - timestamp) / 60000);
}

export function relativeDay(date) {
  const today = new Date();
  const d = new Date(date);
  const diff = daysBetween(d, today);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff > 1 && diff < 7) return `${diff}d_ago`;
  return todayKey(d);
}
