/**
 * ambient.js — атмосферная музыка и фоновые звуки убежища.
 *
 * Ни одного файла: каждая тема получает свой звуковой пейзаж,
 * синтезированный через WebAudio. Пресет описывает слои —
 * гул, шум, пульс, случайные удары. Смена темы плавно
 * переключает пейзаж. Всё личное, состояние в localStorage.
 */
import * as storage from '../core/storage.js';

let ctx = null;
let master = null;       // общий выход музыки
let musicGain = null;    // громкость музыки
let layers = [];         // активные узлы текущего пресета
let timers = [];         // таймеры случайных событий
let running = false;
let currentPreset = null;

let enabled = storage.get('musicOn', false);
let musicVolume = storage.get('vol:music', 0.6);
let masterVolume = storage.get('vol:master', 0.8);

/* ============================================================
   ПРЕСЕТЫ ПО ТЕМАМ
   Каждый описывает слои звука. Синтез — в build().
   ============================================================ */
const PRESETS = {
  // 🔴 тревожные синтезаторы, сирены, металлические удары
  red: {
    drones: [{ f: 55, type: 'sawtooth', g: 0.10 }, { f: 82.5, type: 'sine', g: 0.06 }],
    noise: { freq: 200, q: 0.8, g: 0.02 },
    siren: { lo: 300, hi: 620, period: 6, g: 0.05 },
    hits: { every: [7, 14], freq: 140, g: 0.14 }
  },
  // 🔵 гул вентиляции, капающая вода, лёгкое эхо
  blue: {
    drones: [{ f: 48, type: 'sine', g: 0.12 }, { f: 72, type: 'sine', g: 0.05 }],
    noise: { freq: 380, q: 0.6, g: 0.05 },
    drips: { every: [3, 9], freq: 900, g: 0.10 }
  },
  // 🟢 военное радио, генераторы, переговоры по рации
  green: {
    drones: [{ f: 60, type: 'square', g: 0.05 }, { f: 90, type: 'sine', g: 0.06 }],
    noise: { freq: 500, q: 1.2, g: 0.03 },
    radio: { every: [8, 18], freq: 1200, g: 0.05 }
  },
  // ⚫ низкий металлический гул, редкие удары металла
  steel: {
    drones: [{ f: 44, type: 'sine', g: 0.14 }, { f: 66, type: 'triangle', g: 0.04 }],
    noise: { freq: 160, q: 0.5, g: 0.02 },
    hits: { every: [10, 22], freq: 100, g: 0.12 }
  },
  // 🟡 старое убежище: гудящие лампы, скрип металла
  rust: {
    drones: [{ f: 50, type: 'sawtooth', g: 0.08 }, { f: 100, type: 'sine', g: 0.05 }],
    noise: { freq: 260, q: 0.7, g: 0.04 },
    hits: { every: [9, 20], freq: 120, g: 0.10 }
  },
  // 🟣 лаборатория: пульсирующие тоны, сигналы приборов
  bio: {
    drones: [{ f: 58, type: 'sine', g: 0.09 }, { f: 87, type: 'triangle', g: 0.05 }],
    noise: { freq: 420, q: 1.0, g: 0.03 },
    beeps: { every: [4, 10], freq: 1400, g: 0.05 }
  }
};

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  musicGain = ctx.createGain();
  master.gain.value = masterVolume;
  musicGain.gain.value = 0;                 // поднимем плавно
  musicGain.connect(master);
  master.connect(ctx.destination);
  return ctx;
}

function makeNoiseBuffer() {
  const size = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Собирает слои пресета */
function build(preset) {
  if (!ctx) return;
  teardown();
  const p = PRESETS[preset] || PRESETS.red;
  running = true;
  currentPreset = preset;

  // Дроны
  for (const d of p.drones) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = d.type; osc.frequency.value = d.f; g.gain.value = d.g;
    osc.connect(g).connect(musicGain); osc.start();
    layers.push(osc);
  }

  // Шум через фильтр
  if (p.noise) {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(); src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = p.noise.freq; bp.Q.value = p.noise.q;
    const g = ctx.createGain(); g.gain.value = p.noise.g;
    src.connect(bp).connect(g).connect(musicGain); src.start();
    layers.push(src);
  }

  // Медленная сирена (red)
  if (p.siren) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = p.siren.lo; g.gain.value = p.siren.g;
    lfo.frequency.value = 1 / p.siren.period;
    lfoG.gain.value = (p.siren.hi - p.siren.lo) / 2;
    lfo.connect(lfoG).connect(osc.frequency);
    osc.connect(g).connect(musicGain); osc.start(); lfo.start();
    layers.push(osc, lfo);
  }

  // Случайные события: удары, капли, радио, сигналы
  const rnd = p.hits || p.drips || p.radio || p.beeps;
  const kind = p.hits ? 'hit' : p.drips ? 'drip' : p.radio ? 'radio' : p.beeps ? 'beep' : null;
  if (rnd && kind) scheduleRandom(rnd, kind);
}

function scheduleRandom(cfg, kind) {
  const [min, max] = cfg.every;
  const delay = (min + Math.random() * (max - min)) * 1000;
  const t = setTimeout(() => {
    if (running) { playEvent(kind, cfg); scheduleRandom(cfg, kind); }
  }, delay);
  timers.push(t);
}

function playEvent(kind, cfg) {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (kind === 'hit') {
    const src = ctx.createBufferSource(); src.buffer = makeNoiseBuffer();
    const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = cfg.freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(cfg.g, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    src.connect(bp).connect(g).connect(musicGain); src.start(now); src.stop(now + 0.4);
  } else if (kind === 'drip') {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(cfg.freq, now);
    osc.frequency.exponentialRampToValueAtTime(cfg.freq * 0.5, now + 0.12);
    g.gain.setValueAtTime(cfg.g, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g).connect(musicGain); osc.start(now); osc.stop(now + 0.2);
  } else if (kind === 'radio' || kind === 'beep') {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'square'; osc.frequency.value = cfg.freq;
    const dur = kind === 'radio' ? 0.5 : 0.12;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(cfg.g, now + 0.02);
    g.gain.setValueAtTime(cfg.g, now + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(musicGain); osc.start(now); osc.stop(now + dur);
  }
}

function teardown() {
  for (const t of timers) clearTimeout(t);
  timers = [];
  for (const n of layers) { try { n.stop(); } catch {} }
  layers = [];
  running = false;
}

function fade(node, target, seconds) {
  if (!node) return;
  const now = ctx.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(node.gain.value, now);
  node.gain.linearRampToValueAtTime(target, now + seconds);
}

/* ============================================================
   ПУБЛИЧНОЕ API
   ============================================================ */

export function isMusicEnabled() { return enabled; }

export function setMusicEnabled(on) {
  enabled = Boolean(on);
  storage.set('musicOn', enabled);
  if (enabled) start(currentPreset || storage.get('pref:theme', 'red'));
  else stop();
  return enabled;
}

export function setMasterVolume(v) {
  masterVolume = Math.max(0, Math.min(1, v));
  storage.set('vol:master', masterVolume);
  if (master) master.gain.value = masterVolume;
}

export function setMusicVolume(v) {
  musicVolume = Math.max(0, Math.min(1, v));
  storage.set('vol:music', musicVolume);
  if (musicGain && enabled) fade(musicGain, musicVolume, 0.3);
}

export function getMasterVolume() { return masterVolume; }
export function getMusicVolume() { return musicVolume; }

/** Запуск/смена пейзажа под тему. Требует пользовательского жеста. */
export function start(theme) {
  if (!enabled) return;
  const audio = ensure();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();
  build(theme || 'red');
  fade(musicGain, musicVolume, 2);
}

/** Плавно сменить тему без остановки музыки */
export function switchTheme(theme) {
  if (!enabled || !ctx) { currentPreset = theme; return; }
  if (theme === currentPreset) return;
  fade(musicGain, 0, 0.6);
  setTimeout(() => { if (enabled) { build(theme); fade(musicGain, musicVolume, 1.2); } }, 650);
}

export function stop() {
  if (!ctx) return;
  fade(musicGain, 0, 0.8);
  setTimeout(teardown, 850);
}

/* Обратная совместимость со старым API (main.js звал setAmbientEnabled) */
export const setAmbientEnabled = setMusicEnabled;
export const isAmbientEnabled = isMusicEnabled;
