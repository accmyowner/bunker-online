/**
 * main.js — точка входа.
 *
 * Порядок важен: сначала применяем сохранённые настройки, чтобы
 * не мигнуть анимацией, которую пользователь отключил, затем поднимаем
 * фон и оболочку, и только потом трогаем сеть.
 */
import { qs } from './core/dom.js';
import { on, emit, EV } from './core/bus.js';
import * as storage from './core/storage.js';
import { initBackground } from './ui/components/background.js';
import { initToasts, toast } from './ui/components/toast.js';
import { mountShell, register, go } from './ui/router.js';
import { bindGlobalSounds, isEnabled, setEnabled, unlock, play } from './audio/sfx.js';
import { icon } from './ui/components/icons.js';
import * as room from './net/room.js';

import { menuScreen } from './ui/screens/menu.js';
import { lobbyScreen } from './ui/screens/lobby.js';
import { gameScreen } from './ui/screens/game.js';
import { rulesScreen } from './ui/screens/rules.js';
import { settingsScreen } from './ui/screens/settings.js';

/** Применяет пользовательские настройки к корню документа */
function applyPreferences() {
  if (storage.get('reduceMotion', false)) document.body.classList.add('no-motion');
  if (storage.get('perfLite', false)) document.body.classList.add('perf-lite');
}

/** Кнопка звука в шапке переключает и меняет иконку */
function wireSoundButton(button) {
  const sync = () => {
    button.innerHTML = icon(isEnabled() ? 'sound' : 'mute');
    button.setAttribute('aria-label', isEnabled() ? 'Выключить звук' : 'Включить звук');
  };
  button.addEventListener('click', () => {
    setEnabled(!isEnabled());
    sync();
    if (isEnabled()) play('confirm');
  });
  sync();
}

/** Убирает заставку, когда всё готово */
function hideBoot() {
  const boot = qs('.boot');
  if (!boot) return;
  boot.classList.add('boot--done');
  setTimeout(() => boot.remove(), 1000);
}

/**
 * Если в адресе есть #КОД — это приглашение.
 * Возвращаем код и чистим адрес, чтобы он не мешал дальше.
 */
function inviteCode() {
  const hash = location.hash.replace('#', '').trim().toUpperCase();
  if (hash.length >= 4 && /^[A-Z0-9]+$/.test(hash)) {
    history.replaceState(null, '', location.pathname + location.search);
    return hash;
  }
  return null;
}

async function boot() {
  applyPreferences();

  initBackground(document);
  initToasts();
  bindGlobalSounds(document);

  const shell = mountShell(qs('#root'));
  wireSoundButton(shell.soundBtn);

  register('menu', menuScreen);
  register('lobby', lobbyScreen);
  register('game', gameScreen);
  register('rules', rulesScreen);
  register('settings', settingsScreen);

  // Первый жест разблокирует звук — требование браузеров
  document.addEventListener('pointerdown', unlock, { once: true, passive: true });

  // Сеть поднимаем параллельно с показом меню, чтобы не ждать CDN
  const netReady = room.init().catch((error) => {
    console.warn('[main] сеть недоступна', error);
    return 'local';
  });

  await go('menu');
  hideBoot();
  await netReady;

  // Если пришли по ссылке-приглашению, сразу предлагаем войти
  const invite = inviteCode();
  if (invite) {
    toast(`Приглашение в комнату ${invite}`, 'info', 5000);
    const name = room.identity().name;
    if (name) {
      try {
        await room.joinRoom(invite, name);
        go('lobby', { code: invite });
      } catch (error) {
        emit(EV.TOAST, { text: error.message || 'Комната недоступна', kind: 'err' });
      }
    }
  }

  // Возврат в комнату после перезагрузки: состояние приходит из сети,
  // и экран сам выберет лобби или игру
  on(EV.ROOM_UPDATE, (state) => {
    if (!state) return;
    const screen = qs('.screen')?.dataset.screen;
    if (state.status === 'game' && screen === 'lobby') go('game');
    if (state.status === 'lobby' && screen === 'game') go('lobby');
  });

  // Сообщаем о разрыве и восстановлении связи
  on(EV.NET_STATUS, (status) => {
    if (status.lost) toast('Связь потеряна. Пытаемся переподключиться…', 'err', 4000);
  });

  on(EV.ROOM_LEFT, (info) => {
    if (info?.reason) toast(info.reason, 'info');
  });
}

boot().catch((error) => {
  console.error('[main] не удалось запустить приложение', error);
  hideBoot();
  document.body.innerHTML =
    '<div style="display:grid;place-items:center;height:100dvh;padding:24px;text-align:center;' +
    'font-family:system-ui;color:#f2f4f8;background:#06070a">' +
    '<div><h1>Не удалось запустить игру</h1>' +
    '<p style="color:#a8b1c1">Откройте страницу через локальный сервер, а не как файл: ' +
    'модули ES не работают по протоколу file://</p></div></div>';
});
