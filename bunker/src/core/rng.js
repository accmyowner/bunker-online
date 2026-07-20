/**
 * rng.js — детерминированный генератор.
 * Одно зерно у всех клиентов = одинаковые карты без лишней синхронизации.
 */

/** Превращает строку в 32-битное зерно */
export function seedFrom(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 — быстрый и достаточно качественный для игры */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function intBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Перемешивание Фишера — Йетса, копия не мутирует исходный массив */
export function shuffle(rng, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Выбирает count различных элементов */
export function sample(rng, list, count) {
  return shuffle(rng, list).slice(0, count);
}

/** Короткий читаемый код комнаты. Без похожих символов: 0/O, 1/I. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode(length = 5) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
}

export function uid() {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
