/**
 * sfx.js — интерфейсные звуки.
 *
 * Ни одного аудиофайла: всё синтезируется на лету через WebAudio.
 * Это ноль сетевых запросов и полный контроль над тембром.
 * Музыки нет — только короткие отклики на действия.
 */
import * as storage from '../core/storage.js';

let ctx = null;
let master = null;
let enabled = storage.get('sound', true);

function ensureContext() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

/** Браузеры запускают звук только после жеста пользователя */
export function unlock() {
  const audio = ensureContext();
  if (audio && audio.state === 'suspended') audio.resume();
}

export function isEnabled() { return enabled; }

export function setEnabled(value) {
  enabled = Boolean(value);
  storage.set('sound', enabled);
  if (enabled) unlock();
  return enabled;
}

/** Один тон с огибающей */
function tone({ freq, type = 'sine', start = 0, duration = 0.12, gain = 0.5, sweepTo = null }) {
  const audio = ensureContext();
  if (!audio) return;

  const at = audio.currentTime + start;
  const osc = audio.createOscillator();
  const env = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, at + duration);

  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(env).connect(master);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** Короткий шумовой удар — металл, щелчки, засовы */
function noise({ start = 0, duration = 0.09, gain = 0.35, filterFreq = 1800, q = 1 }) {
  const audio = ensureContext();
  if (!audio) return;

  const at = audio.currentTime + start;
  const frames = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }

  const source = audio.createBufferSource();
  source.buffer = buffer;

  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = q;

  const env = audio.createGain();
  env.gain.setValueAtTime(gain, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  source.connect(filter).connect(env).connect(master);
  source.start(at);
}

/** Палитра звуков. Ключ = событие интерфейса. */
const VOICES = {
  hover:   () => tone({ freq: 880, type: 'sine', duration: 0.04, gain: 0.10 }),
  click:   () => { noise({ duration: 0.05, gain: 0.30, filterFreq: 2600, q: 2 });
                   tone({ freq: 320, type: 'triangle', duration: 0.07, gain: 0.28 }); },
  back:    () => tone({ freq: 420, type: 'triangle', duration: 0.10, gain: 0.25, sweepTo: 220 }),
  confirm: () => { tone({ freq: 523, type: 'sine', duration: 0.10, gain: 0.30 });
                   tone({ freq: 784, type: 'sine', start: 0.07, duration: 0.14, gain: 0.26 }); },
  error:   () => { tone({ freq: 180, type: 'sawtooth', duration: 0.16, gain: 0.24 });
                   tone({ freq: 140, type: 'sawtooth', start: 0.09, duration: 0.18, gain: 0.20 }); },
  card:    () => { noise({ duration: 0.11, gain: 0.26, filterFreq: 1100, q: 1.4 });
                   tone({ freq: 660, type: 'sine', start: 0.04, duration: 0.16, gain: 0.22, sweepTo: 990 }); },
  vote:    () => { noise({ duration: 0.07, gain: 0.30, filterFreq: 900, q: 3 });
                   tone({ freq: 240, type: 'square', duration: 0.09, gain: 0.18 }); },
  eject:   () => { tone({ freq: 300, type: 'sawtooth', duration: 0.42, gain: 0.30, sweepTo: 80 });
                   noise({ start: 0.05, duration: 0.30, gain: 0.28, filterFreq: 500, q: .8 }); },
  join:    () => tone({ freq: 620, type: 'sine', duration: 0.12, gain: 0.24, sweepTo: 930 }),
  seal:    () => { noise({ duration: 0.5, gain: 0.34, filterFreq: 320, q: .7 });
                   tone({ freq: 110, type: 'sine', duration: 0.7, gain: 0.30, sweepTo: 55 }); },
  win:     () => { [523, 659, 784, 1046].forEach((freq, index) =>
                     tone({ freq, type: 'sine', start: index * 0.11, duration: 0.28, gain: 0.24 })); }
};

/** Проигрывает звук по имени */
export function play(name) {
  if (!enabled) return;
  const voice = VOICES[name];
  if (!voice) return;
  try { ensureContext(); voice(); }
  catch (error) { console.warn('[sfx] не удалось воспроизвести', name, error); }
}

/**
 * Глобальное озвучивание кликов: вешается один раз на документ.
 * Элемент может отказаться через data-silent или задать свой звук
 * через data-sfx="confirm".
 */
export function bindGlobalSounds(root = document) {
  root.addEventListener('pointerdown', (event) => {
    const target = event.target.closest('button, [role="button"], a');
    if (!target || target.hasAttribute('data-silent')) return;
    unlock();
    play(target.dataset.sfx || 'click');
  }, { passive: true });
}
