/**
 * roomSettings.js — панель настроек партии в лобби.
 *
 * Показывает выбор времени на ход, обсуждение, голосование и режим
 * окончания игры. Менять может только ведущий; остальные видят
 * выбранные значения в режиме «только чтение».
 *
 * Настройки пишутся в room.settings обычным патчем — та же сетевая
 * дорога, что и у всего остального. Саму функцию создания комнаты
 * и сеть это не трогает.
 */
import { el, clear } from '../../core/dom.js';
import { icon } from './icons.js';
import * as room from '../../net/room.js';
import {
  TURN_TIME_OPTIONS, DISCUSS_TIME_OPTIONS, VOTE_TIME_OPTIONS,
  REVEAL_COUNT_OPTIONS, timing
} from '../../game/engine.js';

/** Ряд кнопок-вариантов. Активный подсвечен; не-ведущему кнопки заблокированы. */
function optionRow({ options, current, canEdit, onPick }) {
  const row = el('div.optrow');
  for (const opt of options) {
    const active = opt.value === current;
    row.append(el(`button.optchip${active ? '.optchip--on' : ''}`, {
      type: 'button',
      disabled: !canEdit,
      'data-silent': true,
      onClick: canEdit ? () => onPick(opt.value) : null,
      text: opt.label
    }));
  }
  return row;
}

/**
 * Строит панель. Возвращает { node, update(state) } — lobby вызывает
 * update при каждом обновлении комнаты.
 */
export function roomSettingsPanel() {
  const body = el('div');

  function writeSetting(key, value) {
    room.patch({ [`settings/${key}`]: value }).catch(() => {});
  }

  function update(state) {
    if (!state) return;
    const canEdit = room.isHost(state);
    const t = timing(state);

    clear(body);
    body.append(
      el('div.setblock', null, [
        el('div.setblock__head', null, [
          el('span.setblock__icon', { html: icon('clock') }),
          el('div', null, [
            el('div.setblock__name', { text: 'Время на рассказ' }),
            el('div.setblock__desc', { text: 'Личное время игрока после раскрытия карты' })
          ])
        ]),
        optionRow({ options: TURN_TIME_OPTIONS, current: t.turnSeconds, canEdit,
          onPick: (v) => writeSetting('turnSeconds', v) })
      ]),

      el('div.setblock', null, [
        el('div.setblock__head', null, [
          el('span.setblock__icon', { html: icon('users') }),
          el('div', null, [
            el('div.setblock__name', { text: 'Общее обсуждение' }),
            el('div.setblock__desc', { text: 'Разговор всех игроков перед голосованием' })
          ])
        ]),
        optionRow({ options: DISCUSS_TIME_OPTIONS, current: t.discussSeconds, canEdit,
          onPick: (v) => writeSetting('discussSeconds', v) })
      ]),

      el('div.setblock', null, [
        el('div.setblock__head', null, [
          el('span.setblock__icon', { html: icon('vote') }),
          el('div', null, [
            el('div.setblock__name', { text: 'Голосование' }),
            el('div.setblock__desc', { text: 'Время на выбор изгнанника' })
          ])
        ]),
        optionRow({ options: VOTE_TIME_OPTIONS, current: t.voteSeconds, canEdit,
          onPick: (v) => writeSetting('voteSeconds', v) })
      ]),

      el('div.setblock', null, [
        el('div.setblock__head', null, [
          el('span.setblock__icon', { html: icon('eye') }),
          el('div', null, [
            el('div.setblock__name', { text: 'Голосование после раскрытия' }),
            el('div.setblock__desc', { text: 'Сколько характеристик открывают перед финальным голосованием' })
          ])
        ]),
        optionRow({
          options: REVEAL_COUNT_OPTIONS,
          current: t.revealCount, canEdit,
          onPick: (v) => writeSetting('revealCount', v)
        })
      ])
    );

    if (!canEdit) {
      body.append(el('p.setting__desc', {
        text: 'Настройки задаёт ведущий комнаты.',
        style: { marginTop: 'var(--s-3)' }
      }));
    }
  }

  return { node: body, update };
}
