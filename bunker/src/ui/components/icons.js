/**
 * icons.js — SVG-иконки в едином штриховом стиле.
 * Один набор, одна толщина линии, скруглённые концы.
 * Возвращают строку разметки, чтобы вставлять куда угодно.
 */
const WRAP = (paths, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;

export const ICONS = {
  /* --- Навигация и действия --- */
  play:     WRAP('<path d="M6 4.5v15l13-7.5-13-7.5Z"/>'),
  plus:     WRAP('<path d="M12 5v14M5 12h14"/>'),
  minus:    WRAP('<path d="M5 12h14"/>'),
  key:      WRAP('<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H21m-3 0v3m-2.5-3v2"/>'),
  book:     WRAP('<path d="M4 5.5A2 2 0 0 1 6 3.5h13v14H6a2 2 0 0 0-2 2V5.5Z"/><path d="M4 19.5A2 2 0 0 1 6 17.5h13v3H6a2 2 0 0 1-2-1Z"/>'),
  gear:     WRAP('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5m15.3-6.3-1.6 1.6M7.8 16.2l-1.6 1.6m11.6 0-1.6-1.6M7.8 7.8 6.2 6.2"/>'),
  back:     WRAP('<path d="M15 5l-7 7 7 7"/>'),
  arrow:    WRAP('<path d="M5 12h13m-5-6 6 6-6 6"/>'),
  close:    WRAP('<path d="M6 6l12 12M18 6 6 18"/>'),
  check:    WRAP('<path d="M5 12.5 10 17.5 19 7"/>'),
  copy:     WRAP('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>'),
  exit:     WRAP('<path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l-4-4 4-4M6 12h11"/>'),
  users:    WRAP('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2M16 5.2A3.2 3.2 0 0 1 16 11m1.5 3.8c2 .7 3.5 2.5 3.5 5.2"/>'),
  sound:    WRAP('<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z"/><path d="M15.5 9.5a4 4 0 0 1 0 5M18 7a7.5 7.5 0 0 1 0 10"/>'),
  mute:     WRAP('<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z"/><path d="m16 10 4 4m0-4-4 4"/>'),
  vote:     WRAP('<path d="M4 11.5 9 16.5 20 5.5"/><path d="M4 19h16"/>'),
  eye:      WRAP('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  eyeOff:   WRAP('<path d="M4 4 20 20"/><path d="M9.6 9.7A2.8 2.8 0 0 0 12 14.8M6.3 6.6C3.9 8.2 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1M18 15.2c2-1.5 3.5-3.2 3.5-3.2S18 5.5 12 5.5c-.7 0-1.4.1-2 .2"/>'),
  crown:    WRAP('<path d="M4 17h16M4 17 3 7l5 4 4-6 4 6 5-4-1 10"/>'),
  clock:    WRAP('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  alert:    WRAP('<path d="M12 4 2.8 20h18.4L12 4Z"/><path d="M12 10v4m0 3h.01"/>'),
  info:     WRAP('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5m0-8h.01"/>'),
  link:     WRAP('<path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5L12.5 17"/>'),
  refresh:  WRAP('<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v4h-4"/>'),
  dice:     WRAP('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01M12 12h.01"/>'),

  /* --- Символ игры: гермодверь --- */
  hatch:    WRAP('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v3M12 17.3v3.2M3.5 12h3M17.3 12h3.2M6 6l2.2 2.2M15.8 15.8 18 18M18 6l-2.2 2.2M8.2 15.8 6 18"/>'),

  /* --- Характеристики персонажа --- */
  profession: WRAP('<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 13h18"/>'),
  health:     WRAP('<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10Z"/>'),
  age:        WRAP('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 1.8"/>'),
  gender:     WRAP('<circle cx="10" cy="14" r="4.5"/><path d="M13.5 10.5 19 5m0 0h-4.2M19 5v4.2"/>'),
  phobia:     WRAP('<path d="M12 4a6.5 6.5 0 0 0-4 11.6V19h8v-3.4A6.5 6.5 0 0 0 12 4Z"/><path d="M9.5 11h.01M14.5 11h.01M10 14.5h4"/>'),
  hobby:      WRAP('<path d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8L6.7 20l1-6L3.4 9.9 9.4 9 12 3.5Z"/>'),
  luggage:    WRAP('<rect x="3.5" y="7.5" width="17" height="12.5" rx="2"/><path d="M8.5 7.5V5.8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.7M8.5 20V7.5m7 12.5V7.5"/>'),
  skill:      WRAP('<path d="M14.5 3.5 17 6l-8.6 8.6-3.4.9.9-3.4L14.5 3.5Z"/><path d="M4 20.5h16"/>'),
  bio:        WRAP('<path d="M7 3.5c0 5 10 6 10 11S7 20.5 7 20.5M17 3.5c0 5-10 6-10 11s10 .5 10 5"/><path d="M8.5 8h7M8.5 16h7"/>'),
  character:  WRAP('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8M9 9.5h.01M15 9.5h.01"/>'),
  special:    WRAP('<path d="M12 3.5 4.5 7v6c0 4.3 3.2 7 7.5 8 4.3-1 7.5-3.7 7.5-8V7L12 3.5Z"/><path d="m9.5 12 1.8 1.8L15 10"/>'),

  /* --- Помещения бункера --- */
  bolt:     WRAP('<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12L13 3Z"/>'),
  wind:     WRAP('<path d="M3 8.5h10a2.75 2.75 0 1 0-2.75-2.75M3 12.5h14.5a3 3 0 1 1-3 3M3 16.5h7.5a2.5 2.5 0 1 1-2.5 2.5"/>'),
  flask:    WRAP('<path d="M9.5 3.5v5.2L4.6 17a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3l-4.9-8.3V3.5"/><path d="M8.5 3.5h7M7.2 14h9.6"/>'),
  wrench:   WRAP('<path d="M16.5 3.5a5 5 0 0 0-4.6 7l-8 8 2.6 2.6 8-8a5 5 0 0 0 6.2-6.4l-3 3-2.4-2.4 3-3a5 5 0 0 0-1.8-.8Z"/>'),
  shield:   WRAP('<path d="M12 3.5 4.5 7v6c0 4.3 3.2 7 7.5 8 4.3-1 7.5-3.7 7.5-8V7L12 3.5Z"/>'),
  sprout:   WRAP('<path d="M12 20v-7"/><path d="M12 13C12 9.5 9.5 7 6 7c0 3.5 2.5 6 6 6ZM12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z"/>'),
  cross:    WRAP('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 8v8m-4-4h8"/>'),
  box:      WRAP('<path d="M3.5 8 12 4l8.5 4v8L12 20l-8.5-4V8Z"/><path d="M3.5 8 12 12l8.5-4M12 12v8"/>'),
  radio:    WRAP('<rect x="3" y="9.5" width="18" height="10.5" rx="2"/><path d="M7.5 9.5 17 5"/><circle cx="8.5" cy="15" r="2.2"/><path d="M13.5 13h4m-4 4h4"/>'),
  dumbbell: WRAP('<path d="M6.5 8v8m-3-6v4m17-4v4M17.5 8v8M6.5 12h11"/>'),
  pot:      WRAP('<path d="M4.5 9.5h15v5a5 5 0 0 1-5 5h-5a5 5 0 0 1-5-5v-5Z"/><path d="M3 9.5h18M8 6.5V4m4 2.5V4m4 2.5V4"/>'),
  atom:     WRAP('<circle cx="12" cy="12" r="2"/><path d="M12 4.5c4.7 0 8.5 3.4 8.5 7.5s-3.8 7.5-8.5 7.5S3.5 16.1 3.5 12 7.3 4.5 12 4.5Z" transform="rotate(60 12 12)"/><path d="M12 4.5c4.7 0 8.5 3.4 8.5 7.5s-3.8 7.5-8.5 7.5S3.5 16.1 3.5 12 7.3 4.5 12 4.5Z" transform="rotate(-60 12 12)"/>'),
  lock:     WRAP('<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
  truck:    WRAP('<path d="M2.5 6.5h11v10h-11z"/><path d="M13.5 10h4l3 3v3.5h-7z"/><circle cx="6.5" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
  food:     WRAP('<path d="M6 3.5v8a2.5 2.5 0 0 0 5 0v-8M8.5 11.5V20.5M17 3.5c-1.5 1.5-2 3.5-2 6v3h3.5v8"/>'),
  drop:     WRAP('<path d="M12 3.5s6 6.4 6 10.2A6 6 0 0 1 6 13.7C6 9.9 12 3.5 12 3.5Z"/>'),
  pill:     WRAP('<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.5 8.5 15.5 15.5"/>'),
  calendar: WRAP('<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v4m8-4v4"/>'),
  seats:    WRAP('<path d="M5 18v-6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V18"/><path d="M3 18h18M7.5 9.5V7a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v2.5"/>')
};

/** Возвращает разметку иконки, безопасно при отсутствии ключа */
export function icon(name) {
  return ICONS[name] || ICONS.info;
}

/** Готовый элемент-иконка */
export function iconEl(name, className = '') {
  const span = document.createElement('span');
  span.className = className;
  span.innerHTML = icon(name);
  span.setAttribute('aria-hidden', 'true');
  return span;
}
