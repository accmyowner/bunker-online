/**
 * card.js — карточка персонажа и плитки характеристик.
 *
 * Компонент ничего не знает о сети: ему передают данные и
 * колбэк onReveal. Это позволяет использовать его и в игре,
 * и в предпросмотре, и в финальном экране.
 */
import { el } from '../../core/dom.js';
import { icon } from './icons.js';
import { TRAIT_ORDER, TRAIT_LABELS } from '../../data/traits.js';

/**
 * Плитка одной характеристики.
 * Скрытая своя карта кликабельна, чужая — просто закрыта.
 */
export function traitTile({ key, value, revealed, actionable, onReveal }) {
  const classes = [
    'button.trait',
    revealed ? 'trait--revealed' : 'trait--hidden',
    key === 'special' ? 'trait--special' : '',
    actionable && !revealed ? 'trait--actionable' : ''
  ].filter(Boolean).join('.');

  const tile = el(classes, {
    type: 'button',
    disabled: !(actionable && !revealed),
    'data-key': key,
    'data-silent': true,
    'aria-label': `${TRAIT_LABELS[key]}: ${revealed ? value : 'засекречено'}`
  }, [
    el('span.trait__key', null, [
      el('span', { html: icon(key) }),
      TRAIT_LABELS[key]
    ]),
    el('span.trait__val', { text: revealed ? value : '— — — — —' })
  ]);

  if (actionable && !revealed && onReveal) {
    tile.addEventListener('click', () => onReveal(key, tile));
  }
  return tile;
}

/** Проигрывает переворот жетона и подставляет открытое значение */
export function animateReveal(tile, value) {
  tile.classList.add('trait--flip');

  // Подменяем текст на середине переворота, когда плитка «ребром»
  setTimeout(() => {
    tile.classList.remove('trait--hidden', 'trait--actionable');
    tile.classList.add('trait--revealed');
    tile.disabled = true;
    const valueNode = tile.querySelector('.trait__val');
    if (valueNode) valueNode.textContent = value;
  }, 280);

  setTimeout(() => {
    tile.classList.remove('trait--flip');
    tile.classList.add('trait--flash');
    setTimeout(() => tile.classList.remove('trait--flash'), 950);
  }, 640);
}

/** Инициалы для аватара */
function initials(name) {
  return String(name || '?').trim().slice(0, 2).toUpperCase();
}

/**
 * Карточка игрока.
 * mine — карточка текущего игрока (видны все свои характеристики).
 */
export function playerCard({
  player,
  character,
  mine = false,
  out = false,
  online = true,
  isHost = false,
  quotaLeft = 0,
  onReveal = null,
  footer = null
}) {
  const traits = character?.traits || {};
  const revealedMap = character?.revealed || {};

  const card = el(`div.pcard${mine ? '.pcard--self' : ''}${out ? '.pcard--out' : ''}`, {
    'data-player': player.id
  });

  /* --- Шапка --- */
  const head = el('div.pcard__head', null, [
    el('div.pcard__avatar', { text: initials(player.name) }),
    el('div.pcard__meta', null, [
      el('div.pcard__name', { text: player.name }),
      el('div.pcard__sub', {
        text: out
          ? 'вне бункера'
          : mine ? 'это вы' : (online ? 'на связи' : 'нет связи')
      })
    ])
  ]);

  const marks = el('div.pcard__marks');
  if (isHost) marks.append(el('span.badge.badge--host', null, [
    el('span', { html: icon('crown') }), 'Ведущий'
  ]));
  if (!out) marks.append(el('span', {
    class: `dot ${online ? 'dot--live' : 'dot--idle'}`,
    title: online ? 'На связи' : 'Нет связи'
  }));
  head.append(marks);
  card.append(head);

  /* --- Характеристики --- */
  const grid = el('div.pcard__traits');
  for (const key of TRAIT_ORDER) {
    const revealed = mine || Boolean(revealedMap[key]);
    grid.append(traitTile({
      key,
      value: traits[key] || '—',
      revealed,
      // Открывать можно только свои и только пока есть норма раунда
      actionable: mine && !revealedMap[key] && quotaLeft > 0 && !out,
      onReveal
    }));
  }
  card.append(grid);

  if (footer) card.append(el('div.pcard__foot', null, footer));
  return card;
}

/** Компактная строка игрока для лобби */
export function seatRow({ player, online, isHost, isYou }) {
  return el(`div.seat${isYou ? '.seat--you' : ''}`, null, [
    el('span', { class: `dot ${online ? 'dot--live' : 'dot--idle'}` }),
    el('span.seat__name', { text: player.name }),
    isHost ? el('span.badge.badge--host', { text: 'Ведущий' }) : null
  ]);
}
