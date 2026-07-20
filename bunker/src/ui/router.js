/**
 * router.js — переключение экранов.
 *
 * Экран — это функция, возвращающая элемент. Если экран
 * подписался на что-то, он кладёт функцию отписки в node.cleanup,
 * и роутер вызовет её при уходе. Так экраны остаются независимыми.
 */
import { el, clear, afterAnimation } from '../core/dom.js';
import { emit, EV } from '../core/bus.js';
import { icon } from './components/icons.js';
import { play } from '../audio/sfx.js';

const routes = new Map();
let stage = null;
let tabbar = null;
let currentName = null;
let currentNode = null;
let busy = false;

/** Регистрирует экран: register('menu', renderFn) */
export function register(name, renderFn) {
  routes.set(name, renderFn);
}

export function current() {
  return currentName;
}

/**
 * Переход на экран. Старый уезжает, новый приезжает.
 * Повторный вызов во время перехода игнорируется — иначе
 * при быстрых нажатиях экраны наслаиваются.
 */
export async function go(name, params = {}) {
  if (busy) return;
  const render = routes.get(name);
  if (!render) {
    console.error(`[router] экран "${name}" не зарегистрирован`);
    return;
  }

  busy = true;
  const previous = currentNode;

  if (previous) {
    previous.dataset.anim = 'out';
    await afterAnimation(previous, 300);
    previous.cleanup?.();
    previous.remove();
  }

  const node = el('div.screen', { 'data-screen': name });
  const inner = el('div.screen__inner');
  const content = render(params);
  inner.append(content);
  node.append(inner);
  if (content.cleanup) node.cleanup = content.cleanup;

  node.dataset.anim = 'in';
  stage.append(node);

  currentName = name;
  currentNode = node;
  syncTabs();
  emit(EV.SCREEN_CHANGE, { name, params });

  busy = false;
}

/** Полная перерисовка текущего экрана — например, после смены состояния комнаты */
export function refresh(params = {}) {
  if (!currentName) return;
  const render = routes.get(currentName);
  if (!render) return;

  const inner = currentNode.querySelector('.screen__inner');
  currentNode.cleanup?.();
  clear(inner);

  const content = render(params);
  inner.append(content);
  currentNode.cleanup = content.cleanup || null;
}

/* ============================================================
   КАРКАС ПРИЛОЖЕНИЯ
   ============================================================ */

const TABS = [
  { name: 'menu',     label: 'Меню',      icon: 'hatch' },
  { name: 'rules',    label: 'Правила',   icon: 'book' },
  { name: 'settings', label: 'Настройки', icon: 'gear' }
];

function syncTabs() {
  if (!tabbar) return;
  for (const button of tabbar.children) {
    button.setAttribute('aria-current', String(button.dataset.tab === currentName));
  }
}

/**
 * Строит оболочку: шапка, сцена, нижние вкладки.
 * Вкладки скрыты на десктопе стилями и появляются на телефоне.
 */
export function mountShell(host) {
  const soundBtn = el('button.iconbtn', {
    'aria-label': 'Звук',
    'data-silent': true,
    html: icon('sound')
  });

  const topbar = el('header.topbar', null, [
    el('div.topbar__brand', null, [
      el('span.topbar__mark', { html: icon('hatch') }),
      el('span', { text: 'Бункер' })
    ]),
    el('div.topbar__spacer'),
    el('div.topbar__tools', null, [soundBtn])
  ]);

  stage = el('main.stage');

  tabbar = el('nav.tabbar', { 'aria-label': 'Основная навигация' });
  for (const tab of TABS) {
    tabbar.append(el('button.tab', {
      'data-tab': tab.name,
      onClick: () => go(tab.name)
    }, [
      el('span', { html: icon(tab.icon) }),
      el('span', { text: tab.label })
    ]));
  }

  const app = el('div.app', null, [topbar, stage, tabbar]);
  host.append(app);

  return { app, topbar, stage, tabbar, soundBtn };
}

/** Универсальная кнопка «назад» для заголовков экранов */
export function backButton(target = 'menu', label = 'Назад') {
  return el('button.btn.btn--ghost.btn--sm', {
    'data-sfx': 'back',
    onClick: () => { play('back'); go(target); }
  }, [
    el('span.btn__icon', { html: icon('back') }),
    label
  ]);
}
