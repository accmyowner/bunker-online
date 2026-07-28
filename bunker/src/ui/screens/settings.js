/**
 * settings.js — настройки оформления и звука.
 * Всё личное, хранится в localStorage, применяется мгновенно.
 */
import { el, clear } from '../../core/dom.js';
import { backButton } from '../router.js';
import { icon } from '../components/icons.js';
import {
  isEnabled, setEnabled, play,
  setSfxVolume, getSfxVolume, setMasterVolume, getMasterVolume
} from '../../audio/sfx.js';
import {
  isMusicEnabled, setMusicEnabled, setMusicVolume, getMusicVolume, start as startMusic
} from '../../audio/ambient.js';
import { isConfigured } from '../../net/config.js';
import * as room from '../../net/room.js';
import { getPref, setPref, THEMES, SPEEDS, FX_LEVELS } from '../prefs.js';

/* --- Переключатель --- */
function toggleRow({ emoji, name, desc, value, onChange }) {
  const control = el('button.switch', {
    role: 'switch', 'aria-checked': String(value), 'aria-label': name, 'data-silent': true
  });
  control.addEventListener('click', () => {
    const next = control.getAttribute('aria-checked') !== 'true';
    control.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return el('div.setrow', null, [
    el('div.setrow__text', null, [
      el('div.setrow__name', null, [emoji ? el('span.setrow__emoji', { text: emoji }) : null, name]),
      desc ? el('div.setrow__desc', { text: desc }) : null
    ]),
    control
  ]);
}

/* --- Ползунок громкости --- */
function sliderRow({ emoji, name, value, onInput }) {
  const pct = el('span.slider__pct', { text: `${Math.round(value * 100)}%` });
  const input = el('input.slider', {
    type: 'range', min: '0', max: '100', value: String(Math.round(value * 100)),
    'aria-label': name, 'data-silent': true
  });
  input.addEventListener('input', () => {
    const v = Number(input.value) / 100;
    pct.textContent = `${input.value}%`;
    onInput(v);
  });
  return el('div.setrow.setrow--stack', null, [
    el('div.slider__head', null, [
      el('div.setrow__name', null, [emoji ? el('span.setrow__emoji', { text: emoji }) : null, name]),
      pct
    ]),
    input
  ]);
}

/* --- Ряд вариантов --- */
function choiceRow({ emoji, name, desc, options, current, onPick }) {
  const row = el('div.optrow');
  for (const opt of options) {
    row.append(el(`button.optchip${opt.value === current ? '.optchip--on' : ''}`, {
      'data-silent': true, text: opt.label, onClick: () => onPick(opt.value)
    }));
  }
  return el('div.setrow.setrow--stack', null, [
    el('div.setrow__text', null, [
      el('div.setrow__name', null, [emoji ? el('span.setrow__emoji', { text: emoji }) : null, name]),
      desc ? el('div.setrow__desc', { text: desc }) : null
    ]),
    row
  ]);
}

/* --- Сетка из 6 тем --- */
function themePicker(current, onPick) {
  const grid = el('div.themegrid');
  for (const theme of THEMES) {
    const active = theme.value === current;
    grid.append(el(`button.themecard${active ? '.themecard--on' : ''}`, {
      'data-silent': true, 'data-theme-preview': theme.value,
      onClick: () => onPick(theme.value)
    }, [
      el('span.themecard__swatch'),
      el('div.themecard__body', null, [
        el('span.themecard__name', null, [theme.dot + ' ', theme.label]),
        el('span.themecard__desc', { text: theme.desc })
      ]),
      active ? el('span.themecard__check', { html: icon('check') }) : null
    ]));
  }
  return grid;
}

function group(title, rows) {
  return el('div.panel', { style: { padding: 'var(--s-5)', marginBottom: 'var(--s-4)' } }, [
    el('div.eyebrow', { text: title, style: { marginBottom: 'var(--s-3)' } }),
    ...rows.filter(Boolean)
  ]);
}

export function settingsScreen() {
  const wrap = el('div');

  function render() {
    clear(wrap);
    wrap.append(
      el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginBottom: 'var(--s-4)' } }, [
        backButton('menu', 'В меню'),
        el('span.badge.badge--amber', null, [el('span', { html: icon('gear') }), 'Настройки'])
      ]),

      // --- Тема ---
      group('🎨 Тема оформления', [
        el('p.setrow__desc', { text: 'Цвет, освещение и музыка меняются вместе.', style: { marginBottom: 'var(--s-3)' } }),
        themePicker(getPref('theme'), (v) => { setPref('theme', v); play('confirm'); render(); })
      ]),

      // --- Громкость ---
      group('🔉 Громкость', [
        sliderRow({ emoji: '🔊', name: 'Общая', value: getMasterVolume(),
          onInput: (v) => { setMasterVolume(v); } }),
        sliderRow({ emoji: '🎚', name: 'Звуки интерфейса', value: getSfxVolume(),
          onInput: (v) => { setSfxVolume(v); } }),
        sliderRow({ emoji: '🎵', name: 'Музыка', value: getMusicVolume(),
          onInput: (v) => { setMusicVolume(v); } })
      ]),

      // --- Звук ---
      group('Звук', [
        toggleRow({ emoji: '🔔', name: 'Звуки интерфейса',
          desc: 'Отклики на нажатия, раскрытие карт, голосование',
          value: isEnabled(), onChange: (v) => { setEnabled(v); if (v) play('confirm'); } }),
        toggleRow({ emoji: '🎶', name: 'Фоновая музыка',
          desc: 'Атмосферный звуковой пейзаж выбранной темы',
          value: isMusicEnabled(), onChange: (v) => { setMusicEnabled(v); if (v) startMusic(getPref('theme')); } })
      ]),

      // --- Оформление ---
      group('Оформление', [
        toggleRow({ emoji: '✨', name: 'Анимации', desc: 'Плавные переходы и движение',
          value: getPref('animations'), onChange: (v) => setPref('animations', v) }),
        toggleRow({ emoji: '🌫', name: 'Живой фон', desc: 'Гермодверь, лампы, дым и частицы',
          value: getPref('liveBg'), onChange: (v) => setPref('liveBg', v) }),
        choiceRow({ emoji: '💡', name: 'Интенсивность эффектов', desc: 'Яркость свечения и частиц',
          options: FX_LEVELS, current: getPref('fxLevel'), onPick: (v) => { setPref('fxLevel', v); render(); } }),
        choiceRow({ emoji: '🎴', name: 'Скорость анимаций', desc: 'Как быстро проигрываются переходы',
          options: SPEEDS, current: getPref('animSpeed'), onPick: (v) => { setPref('animSpeed', v); render(); } })
      ]),

      // --- Комфорт ---
      group('Комфорт', [
        toggleRow({ emoji: '📳', name: 'Тряска экрана', desc: 'Лёгкое дрожание при изгнании и тревоге',
          value: getPref('screenShake'), onChange: (v) => setPref('screenShake', v) }),
        toggleRow({ emoji: '⚡', name: 'Меньше вспышек', desc: 'Приглушает мигание аварийного света',
          value: getPref('reduceFlashes'), onChange: (v) => setPref('reduceFlashes', v) })
      ]),

      // --- Подключение ---
      group('Подключение', [
        el('div.setrow', null, [
          el('div.setrow__text', null, [
            el('div.setrow__name', { text: isConfigured() ? 'Firebase подключён' : 'Локальный режим' }),
            el('div.setrow__desc', { text: isConfigured() ? 'Комнаты работают между устройствами' : 'Комнаты живут между вкладками браузера' })
          ]),
          el('span', { class: `badge ${isConfigured() ? 'badge--cyan' : ''}`, text: room.mode() })
        ])
      ])
    );
  }

  render();
  return wrap;
}
