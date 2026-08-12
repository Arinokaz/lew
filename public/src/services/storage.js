const PREFIX = "lew.";

export function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[storage] get failed", key, e);
    return fallback;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn("[storage] set failed", key, e);
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    console.warn("[storage] remove failed", key, e);
  }
}

export function getString(key, fallback = "") {
  const v = get(key, fallback);
  return typeof v === "string" ? v : fallback;
}

export function getBool(key, fallback = false) {
  const v = get(key, fallback);
  return Boolean(v);
}

export function getNumber(key, fallback = 0) {
  const v = get(key, fallback);
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getArray(key, fallback = []) {
  const v = get(key, fallback);
  return Array.isArray(v) ? v : fallback;
}
