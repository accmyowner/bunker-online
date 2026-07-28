/**
 * sidePanel.js — боковая панель с чатом и личными заметками.
 *
 * Самодостаточный виджет: монтируется в body, сам подписывается на
 * обновления комнаты и сам убирает за собой. Игровой экран вызывает
 * mountSidePanel() и снимает панель в cleanup.
 *
 * ПК: панель справа, сворачивается, ширину можно тянуть.
 * Телефон: кнопка 💬, открывается на весь экран, закрывается крестиком.
 *
 * Чат идёт через сеть (room.patch), заметки — только localStorage.
 */
import { el, clear } from '../../core/dom.js';
import { on, emit, EV } from '../../core/bus.js';
import { icon } from './icons.js';
import * as room from '../../net/room.js';
import * as storage from '../../core/storage.js';
import { play } from '../../audio/sfx.js';
import { sendMessage, readMessages, CHAT_MAX_LEN } from './chat.js';
import { readNotes, writeNotes, clearNotes } from './notes.js';

const WIDTH_KEY = 'sidepanel:width';
const TAB_KEY = 'sidepanel:tab';
const COLLAPSED_KEY = 'sidepanel:collapsed';
const MIN_W = 280;
const MAX_W = 560;

function timeLabel(t) {
  try {
    return new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export function mountSidePanel({ host = document.body } = {}) {
  const code = room.currentCode();
  let tab = storage.get(TAB_KEY, 'chat');
  let collapsed = storage.get(COLLAPSED_KEY, false);
  let width = Math.min(MAX_W, Math.max(MIN_W, storage.get(WIDTH_KEY, 340)));

  /* --- Каркас --- */
  const root = el('div.side', { 'data-tab': tab });
  root.style.setProperty('--side-w', `${width}px`);
  if (collapsed) root.classList.add('side--collapsed');

  // Ручка изменения ширины (ПК)
  const grip = el('div.side__grip', { title: 'Потяните, чтобы изменить ширину' });

  // Шапка с вкладками
  const tabChat = el('button.side__tab', { 'data-silent': true, text: '💬 Чат' });
  const tabNotes = el('button.side__tab', { 'data-silent': true, text: '📝 Заметки' });
  const collapseBtn = el('button.side__collapse', {
    'data-silent': true, title: 'Свернуть', html: icon('chevronRight')
  });
  const header = el('div.side__head', null, [
    el('div.side__tabs', null, [tabChat, tabNotes]),
    collapseBtn
  ]);

  // Тело (сюда рисуем активную вкладку)
  const body = el('div.side__body');

  root.append(grip, header, body);

  // Кнопка-пузырь для телефона и сворачивания
  const bubble = el('button.side__bubble', {
    'data-silent': true, 'aria-label': 'Открыть чат',
    html: icon('chat')
  });
  const unreadDot = el('span.side__unread');
  bubble.append(unreadDot);

  host.append(root, bubble);

  /* --- Сдвиг основного контента на ПК, чтобы панель не перекрывала --- */
  const isDesktop = () => window.matchMedia('(min-width: 861px)').matches;
  function syncLayout() {
    if (isDesktop() && !collapsed) {
      document.body.classList.add('has-side');
      document.body.style.setProperty('--side-shift', `${width}px`);
    } else {
      document.body.classList.remove('has-side');
      document.body.style.removeProperty('--side-shift');
    }
  }
  syncLayout();
  window.addEventListener('resize', syncLayout);

  /* --- Состояние чата --- */
  let lastSeenCount = 0;
  let hasUnread = false;

  /* ========================================================
     ОТРИСОВКА ВКЛАДОК
     ======================================================== */

  function renderChat() {
    clear(body);

    const listWrap = el('div.chat__scroll');
    const list = el('div.chat__list');
    listWrap.append(list);

    const state = room.current();
    const messages = readMessages(state);
    const meId = room.identity().id;

    if (!messages.length) {
      list.append(el('div.chat__empty', { text: 'Пока сообщений нет. Напишите первым.' }));
    }
    for (const m of messages) {
      const mine = m.uid === meId;
      list.append(el(`div.msg${mine ? '.msg--mine' : ''}`, null, [
        el('div.msg__head', null, [
          el('span.msg__name', { text: m.name || 'Игрок' }),
          el('span.msg__time', { text: timeLabel(m.t) })
        ]),
        el('div.msg__text', { text: m.text })
      ]));
    }

    // Поле ввода
    const input = el('textarea.chat__input', {
      rows: '1', maxlength: String(CHAT_MAX_LEN),
      placeholder: 'Сообщение… (Enter — отправить, Shift+Enter — новая строка)'
    });
    const counter = el('span.chat__counter', { text: `0/${CHAT_MAX_LEN}` });
    const sendBtn = el('button.chat__send', {
      'data-silent': true, html: icon('send'), title: 'Отправить'
    });

    const doSend = async () => {
      const text = input.value;
      if (!text.trim()) return;
      const res = await sendMessage(text);
      if (res.ok) {
        input.value = '';
        counter.textContent = `0/${CHAT_MAX_LEN}`;
        autosize();
        play('click');
      } else if (res.reason === 'rate') {
        emit(EV.TOAST, { text: 'Не так часто — подождите секунду', kind: 'info' });
      } else if (res.reason === 'too_long') {
        emit(EV.TOAST, { text: `Максимум ${CHAT_MAX_LEN} символов`, kind: 'err' });
      } else if (res.reason === 'network') {
        emit(EV.TOAST, { text: 'Не удалось отправить', kind: 'err' });
      }
    };

    const autosize = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(120, input.scrollHeight) + 'px';
    };

    input.addEventListener('input', () => {
      counter.textContent = `${input.value.length}/${CHAT_MAX_LEN}`;
      autosize();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });
    sendBtn.addEventListener('click', doSend);

    const composer = el('div.chat__composer', null, [
      input,
      el('div.chat__composer-side', null, [counter, sendBtn])
    ]);

    body.append(listWrap, composer);

    // Прокрутка вниз
    requestAnimationFrame(() => { listWrap.scrollTop = listWrap.scrollHeight; });

    lastSeenCount = messages.length;
    hasUnread = false;
    unreadDot.classList.remove('side__unread--on');
  }

  function renderNotes() {
    clear(body);

    const area = el('textarea.notes__area', {
      placeholder: 'Личные заметки только для вас.\n\nНапример:\n\nИван — врач, боится высоты, у него генератор, не голосовать пока\n\nНикто, кроме вас, этого не увидит.'
    });
    area.value = readNotes(code);

    // Автосохранение при каждом вводе
    area.addEventListener('input', () => writeNotes(code, area.value));

    const savedHint = el('span.notes__hint', { text: 'Сохраняется автоматически на этом устройстве' });
    const clearBtn = el('button.btn.btn--sm.btn--danger', {
      'data-silent': true
    }, [el('span.btn__icon', { html: icon('trash') }), 'Очистить заметки']);
    clearBtn.addEventListener('click', () => {
      if (!area.value.trim()) return;
      clearNotes(code);
      area.value = '';
      emit(EV.TOAST, { text: 'Заметки очищены', kind: 'ok' });
    });

    body.append(
      el('div.notes__wrap', null, [
        el('div.notes__lead', null, [
          el('span.notes__badge', { text: '🔒 Только для вас' }),
          savedHint
        ]),
        area
      ]),
      el('div.notes__foot', null, [clearBtn])
    );
  }

  function renderActive() {
    tabChat.classList.toggle('side__tab--on', tab === 'chat');
    tabNotes.classList.toggle('side__tab--on', tab === 'notes');
    root.setAttribute('data-tab', tab);
    if (tab === 'chat') renderChat(); else renderNotes();
  }

  /* ========================================================
     ВКЛАДКИ, СВОРАЧИВАНИЕ, ПУЗЫРЬ
     ======================================================== */

  function setTab(next) {
    tab = next;
    storage.set(TAB_KEY, next);
    renderActive();
  }
  tabChat.addEventListener('click', () => setTab('chat'));
  tabNotes.addEventListener('click', () => setTab('notes'));

  function setCollapsed(next) {
    collapsed = next;
    storage.set(COLLAPSED_KEY, next);
    root.classList.toggle('side--collapsed', next);
    syncLayout();
  }
  collapseBtn.addEventListener('click', () => setCollapsed(true));

  // Пузырь: на ПК разворачивает свёрнутую панель, на телефоне открывает оверлей
  bubble.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 860px)').matches) {
      root.classList.add('side--open');
    } else {
      setCollapsed(false);
    }
    if (tab === 'chat') renderActive();
    hasUnread = false;
    unreadDot.classList.remove('side__unread--on');
  });

  // Закрытие на телефоне
  const closeBtn = el('button.side__close', { 'data-silent': true, html: icon('close'), title: 'Закрыть' });
  closeBtn.addEventListener('click', () => root.classList.remove('side--open'));
  header.append(closeBtn);

  /* ========================================================
     ИЗМЕНЕНИЕ ШИРИНЫ (ПК)
     ======================================================== */
  let dragging = false;
  grip.addEventListener('pointerdown', (e) => {
    dragging = true;
    grip.setPointerCapture(e.pointerId);
    document.body.classList.add('side-resizing');
  });
  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const next = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX));
    width = next;
    root.style.setProperty('--side-w', `${next}px`);
    if (isDesktop()) document.body.style.setProperty('--side-shift', `${next}px`);
  });
  const stopDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try { grip.releasePointerCapture(e.pointerId); } catch {}
    document.body.classList.remove('side-resizing');
    storage.set(WIDTH_KEY, width);
  };
  grip.addEventListener('pointerup', stopDrag);
  grip.addEventListener('pointercancel', stopDrag);

  /* ========================================================
     ОБНОВЛЕНИЯ КОМНАТЫ
     ======================================================== */
  const off = on(EV.ROOM_UPDATE, (state) => {
    if (tab === 'chat') {
      // Перерисовываем чат, только если появились новые сообщения
      const msgs = readMessages(state);
      if (msgs.length !== lastSeenCount) {
        const wasAtBottom = true;
        renderChat();
      }
    }
    // Индикатор непрочитанного, если панель свёрнута/закрыта
    const closed = collapsed || (!root.classList.contains('side--open') &&
      window.matchMedia('(max-width: 860px)').matches);
    if (closed) {
      const msgs = readMessages(state);
      if (msgs.length > lastSeenCount) {
        hasUnread = true;
        unreadDot.classList.add('side__unread--on');
      }
    }
  });

  renderActive();

  return () => {
    off();
    window.removeEventListener('resize', syncLayout);
    document.body.classList.remove('has-side');
    document.body.style.removeProperty('--side-shift');
    root.remove();
    bubble.remove();
  };
}
