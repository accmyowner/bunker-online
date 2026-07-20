/**
 * menu.js — главное меню.
 * Пять входов в игру плюс краткая сводка о состоянии подключения.
 */
import { el, stagger } from '../../core/dom.js';
import { emit, EV } from '../../core/bus.js';
import { icon } from '../components/icons.js';
import { prompt, modal } from '../components/modal.js';
import { go } from '../router.js';
import * as room from '../../net/room.js';
import { play } from '../../audio/sfx.js';
import { CATASTROPHES } from '../../data/catastrophes.js';
import { PROFESSIONS } from '../../data/traits.js';

/** Спрашивает имя, запоминая прошлое */
async function askName(title = 'Как вас зовут?') {
  const saved = room.identity().name;
  const name = await prompt({
    title,
    label: 'Имя в игре',
    value: saved,
    placeholder: 'Например, Ковалёв',
    ok: 'Продолжить'
  });
  if (name === null) return null;
  if (!name) {
    emit(EV.TOAST, { text: 'Имя не может быть пустым', kind: 'err' });
    return null;
  }
  return name;
}

async function handleCreate() {
  const name = await askName('Создание комнаты');
  if (!name) return;
  try {
    const code = await room.createRoom(name);
    play('confirm');
    go('lobby', { code });
  } catch (error) {
    emit(EV.TOAST, { text: error.message || 'Не удалось создать комнату', kind: 'err' });
  }
}

async function handleJoin(prefill = '') {
  const code = await prompt({
    title: 'Вход по коду',
    label: 'Код комнаты',
    value: prefill,
    placeholder: 'XXXXX',
    ok: 'Найти',
    maxLength: 6
  });
  if (!code) return;

  const name = await askName('Как вас зовут?');
  if (!name) return;

  try {
    const joined = await room.joinRoom(code, name);
    play('join');
    go('lobby', { code: joined });
  } catch (error) {
    emit(EV.TOAST, { text: error.message || 'Не удалось подключиться', kind: 'err' });
  }
}

/** «Играть онлайн» — возвращает в прошлую комнату либо предлагает выбор */
async function handleQuickPlay() {
  const saved = room.savedRoom();
  if (saved) {
    const choice = await modal({
      title: 'Продолжить игру?',
      body: `Вы были в комнате ${saved}. Вернуться туда или начать заново?`,
      icon: 'refresh',
      actions: [
        { label: 'Новая комната', value: 'new' },
        { label: `Вернуться в ${saved}`, value: 'resume', variant: 'primary', primary: true }
      ]
    });
    if (choice === 'resume') {
      const name = room.identity().name || (await askName());
      if (!name) return;
      try {
        await room.joinRoom(saved, name);
        go('lobby', { code: saved });
        return;
      } catch (error) {
        emit(EV.TOAST, { text: error.message || 'Комната недоступна', kind: 'err' });
      }
    } else if (choice === 'new') {
      handleCreate();
      return;
    } else {
      return;
    }
  }
  handleCreate();
}

/** Кнопка меню с номером слота и стрелкой */
function menuButton({ slot, label, iconName, variant, onClick }) {
  return el(`button.btn.btn--menu${variant ? '.btn--' + variant : ''}`, { onClick }, [
    el('span.btn__slot', { text: slot }),
    el('span.btn__icon', { html: icon(iconName) }),
    el('span', { text: label }),
    el('span.btn__arrow', { html: icon('arrow') })
  ]);
}

export function menuScreen() {
  const mode = room.mode();

  const stats = el('div.menu__stats', null, [
    el('span.badge.badge--amber', null, [
      el('span', { html: icon('alert') }),
      `${CATASTROPHES.length} катастроф`
    ]),
    el('span.badge', null, [
      el('span', { html: icon('profession') }),
      `${PROFESSIONS.length} профессий`
    ]),
    mode === 'firebase'
      ? el('span.badge.badge--cyan', null, [el('span.dot.dot--live'), 'Онлайн-режим'])
      : el('span.badge', null, [el('span.dot.dot--idle'), 'Локальный режим'])
  ]);

  const hero = el('div.menu__hero', null, [
    el('div.eyebrow', { text: 'Протокол выживания · Уровень доступа A' }),
    el('h1.menu__title', { text: 'Бункер' }),
    el('p.menu__lead', {
      text: 'Мест меньше, чем людей. У каждого своя профессия, здоровье и тайна. ' +
            'Убедите остальных, что именно вы нужны за гермозатвором — или останьтесь снаружи.'
    }),
    stats
  ]);

  const nav = stagger(el('div.panel.menu__nav', null, [
    el('div.menu__navtitle', null, [
      el('span.eyebrow', { text: 'Выберите действие' }),
      el('span.badge', { text: mode === 'firebase' ? 'Сеть' : 'Одно устройство' })
    ]),
    menuButton({ slot: '01', label: 'Играть онлайн', iconName: 'play', variant: 'primary', onClick: handleQuickPlay }),
    menuButton({ slot: '02', label: 'Создать комнату', iconName: 'plus', onClick: handleCreate }),
    menuButton({ slot: '03', label: 'Подключиться по коду', iconName: 'key', onClick: () => handleJoin() }),
    menuButton({ slot: '04', label: 'Правила', iconName: 'book', onClick: () => go('rules') }),
    menuButton({ slot: '05', label: 'Настройки', iconName: 'gear', onClick: () => go('settings') })
  ]));

  return el('div.menu', null, [hero, nav]);
}
