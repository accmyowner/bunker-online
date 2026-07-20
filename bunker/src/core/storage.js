/**
 * storage.js — настройки и профиль игрока.
 * Пишем в localStorage, но всегда с запасным вариантом в памяти:
 * в приватном режиме и в песочницах хранилище может быть недоступно.
 */
const memory = new Map();
const KEY = 'bunker:v1';

let available = false;
try {
  const probe = '__bunker_probe__';
  window.localStorage.setItem(probe, '1');
  window.localStorage.removeItem(probe);
  available = true;
} catch { available = false; }

function readAll() {
  if (!available) return Object.fromEntries(memory);
  try { return JSON.parse(window.localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

function writeAll(data) {
  if (!available) {
    memory.clear();
    for (const [key, value] of Object.entries(data)) memory.set(key, value);
    return;
  }
  try { window.localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { /* переполнение — молча игнорируем */ }
}

export function get(key, fallback = null) {
  const data = readAll();
  return key in data ? data[key] : fallback;
}

export function set(key, value) {
  const data = readAll();
  data[key] = value;
  writeAll(data);
  return value;
}

export function remove(key) {
  const data = readAll();
  delete data[key];
  writeAll(data);
}
