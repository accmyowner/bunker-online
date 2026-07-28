/**
 * prefs.js — личные настройки оформления и звука.
 *
 * Хранит выбор пользователя в localStorage (core/storage) и применяет
 * к документу. Смена темы синхронно переключает и цвет, и музыку.
 * К игровой логике и сети отношения не имеет.
 */
import * as storage from '../core/storage.js';
import { switchTheme as switchMusicTheme } from '../audio/ambient.js';

/** Шесть полных тем: цвет + освещение + музыкальный пейзаж */
export const THEMES = [
  { value: 'red',   label: 'Red Alert',   dot: '🔴', desc: 'Тревога и опасность' },
  { value: 'blue',  label: 'Deep Bunker', dot: '🔵', desc: 'Затопленный отсек' },
  { value: 'green', label: 'Military',    dot: '🟢', desc: 'Армейская база' },
  { value: 'steel', label: 'Dark Steel',  dot: '⚫', desc: 'Строгий индустриал' },
  { value: 'rust',  label: 'Rust',        dot: '🟡', desc: 'Заброшенное убежище' },
  { value: 'bio',   label: 'Biohazard',   dot: '🟣', desc: 'Секретная лаборатория' }
];

export const SPEEDS = [
  { value: 'slow',   label: 'Медленно' },
  { value: 'normal', label: 'Нормально' },
  { value: 'fast',   label: 'Быстро' }
];

export const FX_LEVELS = [
  { value: 'low',    label: 'Слабые' },
  { value: 'normal', label: 'Обычные' },
  { value: 'high',   label: 'Сильные' }
];

const DEFAULTS = {
  theme: 'red',
  animations: true,
  liveBg: true,
  animSpeed: 'normal',
  fxLevel: 'normal',
  screenShake: true,
  reduceFlashes: false
};

export function getPref(key) {
  const v = storage.get(`pref:${key}`, undefined);
  return v === undefined ? DEFAULTS[key] : v;
}

export function setPref(key, value) {
  storage.set(`pref:${key}`, value);
  applyOne(key, value);
}

function applyOne(key, value) {
  const body = document.body;
  switch (key) {
    case 'theme':
      document.documentElement.setAttribute('data-theme', value);
      switchMusicTheme(value);           // музыка следует за темой
      break;
    case 'animations':
      body.classList.toggle('no-motion', !value);
      break;
    case 'liveBg':
      body.classList.toggle('bg-off', !value);
      break;
    case 'animSpeed':
      body.setAttribute('data-anim-speed', value);
      break;
    case 'fxLevel':
      body.setAttribute('data-fx', value);
      break;
    case 'screenShake':
      body.classList.toggle('no-shake', !value);
      break;
    case 'reduceFlashes':
      body.classList.toggle('reduce-flash', value);
      break;
    default:
      break;
  }
}

/** Применяет все сохранённые настройки. Вызывается на старте. */
export function applyAllPrefs() {
  for (const key of Object.keys(DEFAULTS)) applyOne(key, getPref(key));
}
