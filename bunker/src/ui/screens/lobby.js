/**
 * lobby.js — комната ожидания.
 *
 * Экран перерисовывает только те части, которые изменились,
 * поэтому обновления от сети не сбрасывают фокус и не дёргают вёрстку.
 */
import { el, clear, stagger } from '../../core/dom.js';
import { on, emit, EV } from '../../core/bus.js';
import { icon } from '../components/icons.js';
import { confirm } from '../components/modal.js';
import { seatRow } from '../components/card.js';
import { go, backButton } from '../router.js';
import * as room from '../../net/room.js';
import { play } from '../../audio/sfx.js';
import { buildGame } from '../../game/engine.js';
import { seatsFor } from '../../data/bunkers.js';

const MIN_PLAYERS = 3;

/** Копирует код в буфер обмена, с запасным вариантом для старых браузеров */
async function copyCode(code) {
  const link = `${location.origin}${location.pathname}#${code}`;
  try {
    await navigator.clipboard.writeText(link);
    emit(EV.TOAST, { text: 'Ссылка скопирована', kind: 'ok' });
  } catch {
    const area = document.createElement('textarea');
    area.value = link;
    document.body.append(area);
    area.select();
    try { document.execCommand('copy'); emit(EV.TOAST, { text: 'Ссылка скопирована', kind: 'ok' }); }
    catch { emit(EV.TOAST, { text: `Код комнаты: ${code}`, kind: 'info' }); }
    area.remove();
  }
}

/** Ведущий начинает партию: генерируем состояние и пишем его целиком */
async function startGame(state) {
  const players = Object.keys(state.players || {});
  if (players.length < MIN_PLAYERS) {
    emit(EV.TOAST, { text: `Нужно минимум ${MIN_PLAYERS} игрока`, kind: 'err' });
    return;
  }

  const ok = await confirm({
    title: 'Запустить игру?',
    text: `Игроков: ${players.length}. Мест в бункере будет ${seatsFor(players.length)}. ` +
          'После старта новые участники не смогут присоединиться.',
    ok: 'Запустить'
  });
  if (!ok) return;

  const startedAt = Date.now();
  const game = buildGame({ ...state, startedAt });

  try {
    await room.patch({ startedAt, status: 'game', game });
    play('seal');
  } catch (error) {
    emit(EV.TOAST, { text: 'Не удалось запустить игру', kind: 'err' });
    console.error(error);
  }
}

export function lobbyScreen() {
  const wrap = el('div.lobby');

  /* --- Левая колонка: код и управление --- */
  const codeValue = el('span.codecard__code', { text: '·····' });
  const codeCard = el('div.panel.codecard', null, [
    el('div.eyebrow', { text: 'Код доступа' }),
    codeValue,
    el('div.codecard__hint', { text: 'Передайте код другим игрокам' }),
    el('div', { style: { display: 'grid', gap: 'var(--s-2)', marginTop: 'var(--s-4)' } }, [
      el('button.btn.btn--sm.btn--block', {
        onClick: () => copyCode(room.currentCode())
      }, [el('span.btn__icon', { html: icon('copy') }), 'Скопировать ссылку']),
      el('button.btn.btn--sm.btn--block.btn--danger', {
        'data-sfx': 'back',
        onClick: async () => {
          const ok = await confirm({
            title: 'Покинуть комнату?',
            text: 'Вы выйдете из лобби. Вернуться можно будет по тому же коду.',
            ok: 'Выйти', danger: true
          });
          if (ok) { await room.leaveRoom(); go('menu'); }
        }
      }, [el('span.btn__icon', { html: icon('exit') }), 'Покинуть'])
    ])
  ]);

  /* --- Правая колонка: игроки и параметры --- */
  const seatsBox = el('div.lobby__players');
  const countBadge = el('span.badge', { text: '0' });
  const seatsInfo = el('span.badge.badge--amber', { text: 'Мест: —' });

  const startBtn = el('button.btn.btn--primary.btn--block', {
    disabled: true,
    'data-sfx': 'confirm'
  }, [el('span.btn__icon', { html: icon('play') }), 'Начать игру']);

  const hint = el('p.setting__desc', { text: '' });

  const playersPanel = el('div.panel', { style: { padding: 'var(--s-5)' } }, [
    el('div.menu__navtitle', null, [
      el('span.eyebrow', { text: 'Участники' }),
      el('span', { style: { display: 'flex', gap: 'var(--s-2)' } }, [countBadge, seatsInfo])
    ]),
    seatsBox,
    el('hr.seam'),
    startBtn,
    hint
  ]);

  wrap.append(codeCard, el('div', { style: { display: 'grid', gap: 'var(--s-4)' } }, [
    el('div', null, [backButton('menu', 'В меню')]),
    playersPanel
  ]));

  /* --- Отрисовка по состоянию --- */
  let lastSignature = null;
  let firstPaint = true;

  function paint(state) {
    if (!state) return;

    // Сердцебиение обновляет lastSeen каждые 15 секунд; без этой
    // проверки список игроков мигал бы анимацией на ровном месте
    const signatureNow = JSON.stringify({
      code: state.code,
      status: state.status,
      host: state.hostId,
      players: Object.entries(state.players || {})
        .map(([id, player]) => [id, player.name, room.isOnline(player)])
    });
    if (signatureNow === lastSignature) return;
    lastSignature = signatureNow;

    codeValue.textContent = state.code;

    const ids = Object.keys(state.players || {});
    const maxPlayers = state.settings?.maxPlayers || 12;
    const meId = room.identity().id;
    const host = room.isHost(state);

    countBadge.textContent = `${ids.length} / ${maxPlayers}`;
    seatsInfo.textContent = `Мест в бункере: ${seatsFor(Math.max(ids.length, MIN_PLAYERS))}`;

    clear(seatsBox);
    for (const id of ids) {
      const player = state.players[id];
      seatsBox.append(seatRow({
        player,
        online: room.isOnline(player),
        isHost: state.hostId === id,
        isYou: id === meId
      }));
    }
    // Пустые слоты показывают, что стол ещё не заполнен
    for (let i = ids.length; i < Math.min(maxPlayers, Math.max(ids.length + 2, 6)); i += 1) {
      seatsBox.append(el('div.seat.seat--empty', { text: 'свободно' }));
    }
    if (firstPaint) stagger(seatsBox);

    startBtn.disabled = !host || ids.length < MIN_PLAYERS;
    startBtn.onclick = host ? () => startGame(state) : null;

    if (!host) {
      hint.textContent = 'Партию запускает ведущий комнаты.';
    } else if (ids.length < MIN_PLAYERS) {
      hint.textContent = `Нужно ещё ${MIN_PLAYERS - ids.length} участника, чтобы начать.`;
    } else {
      hint.textContent = 'Все в сборе — можно запускать.';
    }

    firstPaint = false;

    // Игра стартовала: уводим всех на игровой экран
    if (state.status === 'game' && state.game) go('game');
  }

  const off = on(EV.ROOM_UPDATE, paint);
  const offLeft = on(EV.ROOM_LEFT, () => go('menu'));
  paint(room.current());

  wrap.cleanup = () => { off(); offLeft(); };
  return wrap;
}
