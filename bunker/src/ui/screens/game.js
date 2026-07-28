/**
 * game.js — игровой экран.
 *
 * Слева сводка: катастрофа, бункер, журнал событий.
 * Справа карточки игроков и действие текущей фазы.
 * Всё состояние приходит из сети, экран только рисует и отправляет ходы.
 */
import { el, clear, stagger } from '../../core/dom.js';
import { on, emit, EV } from '../../core/bus.js';
import { icon } from '../components/icons.js';
import { confirm } from '../components/modal.js';
import { playerCard, animateReveal } from '../components/card.js';
import { mountSidePanel } from '../components/sidePanel.js';
import { go } from '../router.js';
import * as room from '../../net/room.js';
import { play } from '../../audio/sfx.js';
import {
  PHASES, PHASE_META, revealsLeft, alivePlayers, isAlive, voteCandidates, tally,
  everyoneRevealed, everyoneVoted, reveal, startVote, castVote, resolveVote, nextRound,
  endTurn, onDeadline, activePlayer, isActiveTurn, turnOrder, secondsLeft, deadlinePassed,
  advanceAfterDiscuss, revealDone
} from '../../game/engine.js';
import { CATASTROPHE_BY_ID } from '../../data/catastrophes.js';

/** Отправляет патч и мягко сообщает об отказе */
/**
 * Отправляет ход в сеть.
 *
 * Ключевой момент: действие вычисляется НЕ от снимка, который был на
 * экране в момент отрисовки, а от самого свежего состояния комнаты
 * (room.current()). Иначе быстрые или одновременные ходы считают
 * счётчики и смену фазы от устаревших данных, и у разных игроков
 * состояние расходится — часть раскрытых карт «пропадает».
 *
 * Принимает либо готовый результат { ok, patch }, либо функцию
 * (freshState) => результат, которой передаётся свежее состояние.
 */
async function send(action) {
  const fresh = room.current();
  const result = typeof action === 'function' ? action(fresh) : action;

  if (!result || !result.ok) {
    emit(EV.TOAST, { text: result?.reason || 'Действие недоступно', kind: 'err' });
    return false;
  }
  try {
    await room.patch(result.patch);
    return true;
  } catch (error) {
    emit(EV.TOAST, { text: 'Нет связи с комнатой', kind: 'err' });
    console.error(error);
    return false;
  }
}

/* ============================================================
   БЛОКИ СВОДКИ
   ============================================================ */

function catastrophePanel(game) {
  const info = CATASTROPHE_BY_ID[game.catastropheId];
  if (!info) return el('div');
  return el('div.panel.brief', null, [
    el('div.eyebrow', { text: 'Внешняя обстановка' }),
    el('h2.brief__name', { text: info.name }),
    el('p.brief__text', { text: info.text }),
    el('hr.seam'),
    el('p.brief__text', { text: info.survivors })
  ]);
}

function resourceRow(iconName, name, value) {
  return el('div.res.res--stacked', null, [
    el('div.res__icon', { html: icon(iconName) }),
    el('div.res__body', null, [
      el('div.res__name', { text: name }),
      // Значение во всю ширину строки: длинные описания (вода, еда,
      // медикаменты) должны использовать всю ширину карточки и не
      // ломаться на короткие обрывки в узкой колонке
      el('div.res__val.res__val--full', { text: value })
    ])
  ]);
}

function bunkerPanel(game) {
  const bunker = game.bunker;
  const rooms = el('div', { style: { display: 'grid', gap: '2px' } });
  for (const item of bunker.rooms) {
    rooms.append(el('div.res', null, [
      el('div.res__icon', {
        html: icon(item.icon),
        style: item.ok ? null : { color: 'var(--c-alarm)', borderColor: 'rgba(255,59,48,.3)', background: 'rgba(255,59,48,.08)' }
      }),
      el('div.res__body', null, [
        el('div.res__row', null, [
          el('span.res__name', { text: item.name }),
          el('span.res__val', {
            text: item.ok ? 'исправно' : 'проблема',
            style: item.ok ? null : { color: 'var(--c-alarm)' }
          })
        ]),
        el('div.res__name', { text: item.status, style: { fontSize: 'var(--fs-xs)', color: 'var(--t-muted)' } })
      ])
    ]));
  }

  return el('div.panel', { style: { padding: 'var(--s-5)' } }, [
    el('div.eyebrow', { text: 'Убежище' }),
    el('div', { style: { marginTop: 'var(--s-3)' } }, [
      resourceRow('seats', 'Вместимость', `${bunker.seats} чел.`),
      resourceRow('calendar', 'Срок автономности', bunker.duration),
      resourceRow('food', 'Продовольствие', bunker.food),
      resourceRow('drop', 'Вода', bunker.water),
      resourceRow('pill', 'Медикаменты', bunker.medicine)
    ]),
    el('hr.seam'),
    el('div.eyebrow', { text: 'Помещения' }),
    rooms,
    el('hr.seam'),
    el('div.eyebrow', { text: 'Особое обстоятельство' }),
    el('p.brief__text', { text: bunker.quirk, style: { marginTop: 'var(--s-2)' } })
  ]);
}

function logPanel(game) {
  const list = el('div.log');
  const entries = game.log.slice(-25).reverse();
  for (const entry of entries) {
    const time = new Date(entry.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    list.append(el(`div.log__item${entry.kind === 'alarm' ? '.log__item--alarm' : ''}${entry.kind === 'good' ? '.log__item--good' : ''}`, null, [
      el('span.log__time', { text: time }),
      el('span', { text: entry.text })
    ]));
  }
  if (!entries.length) list.append(el('div.empty', { text: 'Событий пока нет' }));
  return list;
}

/* ============================================================
   ФАЗЫ
   ============================================================ */

/** Подпись под карточкой: зависит от фазы и того, чей ход */
function buildCardFooter(state, id, mine, activeId) {
  const game = state.game;
  if (!mine) {
    if (id === activeId && (game.phase === PHASES.REVEAL || game.phase === PHASES.TURN)) {
      return [el('span.badge.badge--cyan', { text: game.phase === PHASES.TURN ? 'Рассказывает' : 'Ходит' })];
    }
    return null;
  }
  // Своя карточка
  if (game.phase === PHASES.REVEAL && activeId === id) {
    return [el('span.badge.badge--amber', { text: 'Ваш ход — откройте карту' })];
  }
  if (game.phase === PHASES.TURN && activeId === id) {
    return [el('span.badge.badge--cyan', { text: 'Ваше время рассказа' })];
  }
  return null;
}

/** Круговой индикатор раунда */
function gauge(round, phase) {
  const order = [PHASES.REVEAL, PHASES.TURN, PHASES.DISCUSS, PHASES.VOTE, PHASES.RESULT];
  const index = Math.max(0, order.indexOf(phase));
  const progress = (index + 1) / order.length;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;

  return el('div.gauge', {
    html: `
      <svg viewBox="0 0 58 58">
        <circle class="gauge__track" cx="29" cy="29" r="${radius}" fill="none" stroke-width="3"/>
        <circle class="gauge__fill" cx="29" cy="29" r="${radius}" fill="none" stroke-width="3"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${circumference * (1 - progress)}"/>
      </svg>
      <span class="gauge__num">${round}</span>`
  });
}

function phaseBar(state) {
  const game = state.game;
  const meta = PHASE_META[game.phase] || PHASE_META.reveal;
  const alive = alivePlayers(state).length;
  const meId = room.identity().id;

  let extra = '';
  if (game.phase === PHASES.REVEAL) {
    const active = activePlayer(state);
    const name = state.players[active]?.name || 'игрок';
    extra = active === meId ? 'Ваш ход — откройте одну карту' : `Ход игрока: ${name}`;
  } else if (game.phase === PHASES.TURN) {
    const active = activePlayer(state);
    const name = state.players[active]?.name || 'игрок';
    extra = active === meId ? 'Ваше время рассказа' : `Рассказывает: ${name}`;
  } else if (game.phase === PHASES.DISCUSS) {
    extra = 'Общий разговор перед голосованием';
  } else if (game.phase === PHASES.VOTE) {
    const voted = Object.keys(game.votes || {}).length;
    extra = `Проголосовали: ${voted} из ${alive}`;
  }

  const children = [
    gauge(game.round, game.phase),
    el('div.phasebar__body', null, [
      el('div.eyebrow', { text: `Раунд ${game.round} · в игре ${alive} · мест ${game.bunker.seats}` }),
      el('div.phasebar__title', { text: meta.title }),
      el('div.phasebar__desc', { text: extra || meta.desc })
    ])
  ];

  // Таймер фазы, если он задан
  const left = secondsLeft(state);
  if (left !== null) {
    children.push(timerChip(left));
  }

  return el('div.panel.phasebar', null, children);
}

/** Компактный таймер с обратным отсчётом */
function timerChip(seconds) {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const text = mm > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : `${ss}`;
  const low = seconds <= 10;
  return el(`div.timer${low ? '.timer--low' : ''}`, null, [
    el('span.timer__icon', { html: icon('clock') }),
    el('span.timer__val', { text })
  ]);
}

/** Панель голосования */
function votePanel(state, refresh) {
  const game = state.game;
  const meId = room.identity().id;
  const counts = tally(state);
  const myVote = game.votes?.[meId];
  const candidates = voteCandidates(state).filter((id) => id !== meId);
  const totalVotes = Object.keys(game.votes || {}).length || 1;

  const grid = el('div.vote');
  for (const id of candidates) {
    const player = state.players[id];
    if (!player) continue;
    const count = counts[id] || 0;

    const button = el(`button.votebtn${myVote === id ? '.votebtn--picked' : ''}`, {
      'data-silent': true,
      disabled: Boolean(myVote) || !isAlive(state, meId),
      onClick: async () => {
        play('vote');
        button.classList.add('votebtn--cast');
        const ok = await send((fresh) => castVote(fresh, meId, id));
        if (!ok) button.classList.remove('votebtn--cast');
      }
    }, [
      el('span.votebtn__fill', { style: { transform: `scaleX(${count / totalVotes})` } }),
      el('span.votebtn__name', { text: player.name }),
      count ? el('span.votebtn__count', { text: String(count) }) : null
    ]);
    grid.append(button);
  }

  const note = myVote
    ? 'Голос принят. Ждём остальных.'
    : 'Выберите, кто останется снаружи. Изменить решение будет нельзя.';

  // Та же страховка, что и на раскрытии: одновременные голоса
  // могли не запустить подсчёт автоматически
  const stuck = everyoneVoted(state) && room.isHost(state);

  // Сколько ещё нужно исключить в финальной серии
  const toRemove = alivePlayers(state).length - game.bunker.seats;
  const heading = game.candidates
    ? 'Переголосование'
    : `Финальное голосование · исключить ещё ${toRemove}`;

  return el('div.panel', { style: { padding: 'var(--s-5)' } }, [
    el('div.eyebrow', { text: heading }),
    el('p.brief__text', { text: note, style: { margin: 'var(--s-2) 0 var(--s-4)' } }),
    grid,
    stuck
      ? el('div.actionbar', null, [
          el('button.btn.btn--primary.btn--block', {
            onClick: () => send((fresh) => resolveVote(fresh))
          }, [el('span.btn__icon', { html: icon('vote') }), 'Подвести итог голосования'])
        ])
      : null
  ]);
}

/** Итог раунда и кнопка перехода дальше */
function resultPanel(state) {
  const game = state.game;
  const victim = state.players[game.lastEliminated];
  const host = room.isHost(state);
  const alive = alivePlayers(state).length;
  const finished = alive <= game.bunker.seats;

  const button = el('button.btn.btn--primary.btn--block', {
    disabled: !host,
    'data-sfx': 'confirm',
    onClick: () => send((fresh) => nextRound(fresh))
  }, [
    el('span.btn__icon', { html: icon(finished ? 'check' : 'vote') }),
    finished ? 'Подвести итоги' : 'Следующее голосование'
  ]);

  const toRemove = alive - game.bunker.seats;

  return el('div.panel', { style: { padding: 'var(--s-5)' } }, [
    el('div.eyebrow', { text: 'Итог голосования' }),
    el('h2.brief__name', { text: victim ? `${victim.name} остаётся снаружи` : 'Решение принято' }),
    el('p.brief__text', {
      text: finished
        ? 'Мест ровно столько, сколько людей. Гермозатвор можно закрывать.'
        : `В игре осталось ${alive} человек, мест ${game.bunker.seats}. Нужно исключить ещё ${toRemove}.`
    }),
    el('div', { style: { marginTop: 'var(--s-4)' } }, [button]),
    !host ? el('p.setting__desc', { text: 'Дальше ведёт ведущий.', style: { marginTop: 'var(--s-2)' } }) : null
  ]);
}

/** Экран финала */
function finalPanel(state) {
  const survivors = alivePlayers(state).map((id) => state.players[id]).filter(Boolean);
  const host = room.isHost(state);
  const game = state.game;
  const info = CATASTROPHE_BY_ID[game.catastropheId];

  const list = el('div.final__list');
  for (const player of survivors) {
    list.append(el('div.final__survivor', null, [
      el('div.pcard__name', { text: player.name }),
      el('div.pcard__sub', { text: 'выжил' })
    ]));
  }

  // Длительность партии
  let duration = '—';
  if (state.startedAt) {
    const secs = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
    const mm = Math.floor(secs / 60);
    const ss = secs % 60;
    duration = mm > 0 ? `${mm} мин ${ss} с` : `${ss} с`;
  }

  const stats = el('div.final__stats', null, [
    el('div.final__stat', null, [
      el('div.final__stat-num', { text: String(survivors.length) }),
      el('div.final__stat-label', { text: 'выжило' })
    ]),
    el('div.final__stat', null, [
      el('div.final__stat-num', { text: String(game.round) }),
      el('div.final__stat-label', { text: 'раундов' })
    ]),
    el('div.final__stat', null, [
      el('div.final__stat-num', { text: String(game.eliminated.length) }),
      el('div.final__stat-label', { text: 'изгнано' })
    ]),
    el('div.final__stat', null, [
      el('div.final__stat-num', { text: duration }),
      el('div.final__stat-label', { text: 'длительность' })
    ])
  ]);

  return el('div.panel.final', null, [
    el('div.eyebrow', { text: 'Гермозатвор запечатан' }),
    el('h1.final__title', { text: 'Бункер закрыт' }),
    info ? el('p.brief__text', {
      text: `Катастрофа: ${info.name}. Эти люди проведут вместе годы — остальные остались снаружи.`
    }) : null,
    stats,
    el('div.eyebrow', { text: 'Состав убежища', style: { marginBottom: 'var(--s-3)' } }),
    list,
    el('div', { style: { display: 'flex', gap: 'var(--s-3)', justifyContent: 'center', flexWrap: 'wrap', marginTop: 'var(--s-5)' } }, [
      host ? el('button.btn.btn--primary', {
        onClick: async () => {
          const ok = await confirm({ title: 'Сыграть ещё?', text: 'Комната вернётся в лобби, состав сохранится.', ok: 'В лобби' });
          if (ok) await room.patch({ status: 'lobby', game: null, startedAt: null });
        }
      }, [el('span.btn__icon', { html: icon('refresh') }), 'Ещё партия']) : null,
      el('button.btn', {
        'data-sfx': 'back',
        onClick: async () => { await room.leaveRoom(); go('menu'); }
      }, [el('span.btn__icon', { html: icon('exit') }), 'Выйти в меню'])
    ])
  ]);
}

/* ============================================================
   ЭКРАН
   ============================================================ */

export function gameScreen() {
  const wrap = el('div.game');
  const aside = el('div.game__aside');
  const main = el('div.game__main');
  wrap.append(aside, main);

  let lastPhase = null;
  let lastEliminated = null;
  let lastSignature = null;
  let firstPaint = true;
  let holdUntil = 0;        // до этого момента не перерисовываем
  let pendingTimer = null;

  /**
   * Отпечаток значимой части состояния.
   * Сердцебиение игроков меняет lastSeen каждые 15 секунд, и без
   * этой проверки экран перерисовывался бы вхолостую, сбивая
   * прокрутку и переигрывая анимации.
   */
  function signature(state) {
    const game = state.game;
    return JSON.stringify({
      status: state.status,
      phase: game?.phase,
      round: game?.round,
      activeIndex: game?.activeIndex,
      deadline: game?.phaseDeadline || 0,
      eliminated: game?.eliminated,
      votes: game?.votes,
      reveals: game?.roundReveals,
      candidates: game?.candidates,
      last: game?.lastEliminated,
      logLength: game?.log?.length,
      players: Object.entries(state.players || {})
        .map(([id, player]) => [id, player.name, room.isOnline(player)]),
      opened: game
        ? Object.entries(game.chars).map(([id, character]) =>
            [id, Object.keys(character.revealed || {}).sort().join(',')])
        : null
    });
  }

  function paint(state) {
    if (!state) return;
    if (!state.game) { go('lobby'); return; }

    // Идёт своя анимация раскрытия — откладываем перерисовку,
    // иначе карта дёрнется и покажет значение без переворота
    if (Date.now() < holdUntil) {
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => paint(room.current()), holdUntil - Date.now() + 40);
      return;
    }

    const signatureNow = signature(state);
    if (signatureNow === lastSignature) return;
    lastSignature = signatureNow;

    const game = state.game;
    const meId = room.identity().id;
    const host = room.isHost(state);

    /* --- Звуковые и визуальные реакции на изменения --- */
    if (lastPhase && lastPhase !== game.phase) {
      if (game.phase === PHASES.VOTE) play('vote');
      if (game.phase === PHASES.ENDED) play('win');
    }

    // Аварийное красное освещение включается на время голосования
    document.body.classList.toggle('voting-alert', game.phase === PHASES.VOTE);

    const justEliminated = game.lastEliminated && game.lastEliminated !== lastEliminated
      ? game.lastEliminated
      : null;
    if (justEliminated) play('eject');
    // Лёгкая тряска экрана при изгнании, если не отключена в настройках
    if (justEliminated && !document.body.classList.contains('no-shake')) {
      const app = document.querySelector('.app');
      if (app) {
        app.classList.remove('shake');
        void app.offsetWidth;         // перезапуск анимации
        app.classList.add('shake');
        setTimeout(() => app.classList.remove('shake'), 550);
      }
    }
    lastPhase = game.phase;
    lastEliminated = game.lastEliminated;

    /* --- Финал --- */
    if (game.phase === PHASES.ENDED) {
      clear(aside);
      clear(main);
      main.append(finalPanel(state));
      aside.append(catastrophePanel(game), bunkerPanel(game));
      return;
    }

    /* --- Сводка --- */
    clear(aside);
    aside.append(catastrophePanel(game), bunkerPanel(game), logPanel(game));

    /* --- Основная колонка --- */
    clear(main);
    main.append(phaseBar(state));

    // Карточки игроков
    const roster = el('div.roster');
    const order = game.order.filter((id) => state.players[id]);
    const activeId = activePlayer(state);
    for (const id of order) {
      const player = state.players[id];
      const mine = id === meId;
      // Открыть карту можно только в СВОЙ ход в фазе REVEAL
      const myTurnToReveal = mine && game.phase === PHASES.REVEAL && activeId === meId;
      const quota = myTurnToReveal ? revealsLeft(state, id) : 0;

      const card = playerCard({
        player,
        character: game.chars[id],
        mine,
        out: !isAlive(state, id),
        online: room.isOnline(player),
        isHost: state.hostId === id,
        quotaLeft: quota,
        onReveal: async (key, tile) => {
          const value = game.chars[id].traits[key];
          play('card');
          // Держим экран от перерисовки только на время переворота жетона
          holdUntil = Date.now() + 680;
          animateReveal(tile, value);
          await send((fresh) => reveal(fresh, id, key));
        },
        footer: buildCardFooter(state, id, mine, activeId)
      });

      // Активный игрок выделяется рамкой
      if (id === activeId && game.phase !== PHASES.DISCUSS && game.phase !== PHASES.VOTE) {
        card.classList.add('pcard--turn');
      }
      if (firstPaint) card.classList.add('pcard--enter');
      roster.append(card);
    }
    if (firstPaint) stagger(roster);
    main.append(roster);

    // Изгнанного подсвечиваем уже после сборки списка
    if (justEliminated) {
      roster.querySelector(`[data-player="${justEliminated}"]`)?.classList.add('pcard--eject');
    }

    /* --- Действие фазы --- */
    if (game.phase === PHASES.REVEAL) {
      const active = activePlayer(state);
      const myTurn = active === meId;
      const activeName = state.players[active]?.name || 'игрок';

      main.append(el('div.panel', { style: { padding: 'var(--s-4) var(--s-5)' } }, [
        el('p.brief__text', {
          text: !isAlive(state, meId)
            ? 'Вы вне игры и наблюдаете за остальными.'
            : myTurn
              ? 'Ваш ход. Нажмите на одну из своих подсвеченных карт, чтобы раскрыть её.'
              : `Сейчас ходит ${activeName}. Дождитесь своей очереди.`
        }),
        // Страховка ведущего: если активный игрок отключился и не ходит,
        // ведущий может пропустить его ход
        host && !myTurn
          ? el('div.actionbar', null, [
              el('button.btn.btn--ghost.btn--sm', {
                onClick: () => send((fresh) => endTurn(fresh))
              }, [el('span.btn__icon', { html: icon('arrow') }), 'Пропустить ход игрока'])
            ])
          : null
      ]));
    }

    if (game.phase === PHASES.TURN) {
      const active = activePlayer(state);
      const myTurn = active === meId;
      const activeName = state.players[active]?.name || 'игрок';

      main.append(el('div.panel', { style: { padding: 'var(--s-5)' } }, [
        el('div.eyebrow', { text: 'Личное время' }),
        el('p.brief__text', {
          text: myTurn
            ? 'Расскажите остальным о своей открытой характеристике. Когда закончите — нажмите «Дальше».'
            : `${activeName} рассказывает о своей карте. Слушайте и задавайте вопросы.`,
          style: { margin: 'var(--s-2) 0 var(--s-4)' }
        }),
        // Дальше двигать может сам игрок (закончил раньше) или ведущий
        (myTurn || host)
          ? el('div.actionbar', null, [
              el('button.btn.btn--primary.btn--block', {
                onClick: () => send((fresh) => endTurn(fresh))
              }, [el('span.btn__icon', { html: icon('arrow') }), 'Дальше'])
            ])
          : el('p.setting__desc', { text: 'Ход завершится по таймеру или когда игрок закончит.' })
      ]));
    }

    if (game.phase === PHASES.DISCUSS) {
      const toFinal = revealDone(state);
      main.append(el('div.panel', { style: { padding: 'var(--s-5)' } }, [
        el('div.eyebrow', { text: 'Общее обсуждение' }),
        el('p.brief__text', {
          text: toFinal
            ? 'Все характеристики раскрыты. Обсудите, кто менее полезен убежищу — ' +
              'дальше начнётся финальное голосование, где игроков исключают по одному до числа мест.'
            : 'Все высказались по своим картам этого круга. Обсудите увиденное. ' +
              'Дальше начнётся следующий раунд — каждый откроет ещё одну характеристику.',
          style: { margin: 'var(--s-2) 0 var(--s-4)' }
        }),
        el('div.actionbar', null, [
          el('button.btn.btn--primary.btn--block', {
            disabled: !host,
            onClick: () => send((fresh) => advanceAfterDiscuss(fresh))
          }, [
            el('span.btn__icon', { html: icon(toFinal ? 'vote' : 'arrow') }),
            toFinal ? 'Начать финальное голосование' : 'Следующий раунд раскрытия'
          ]),
        ]),
        !host ? el('p.setting__desc', { text: 'Дальше ведёт ведущий комнаты.' }) : null
      ]));
    }

    if (game.phase === PHASES.VOTE) main.append(votePanel(state));
    if (game.phase === PHASES.RESULT) main.append(resultPanel(state));

    firstPaint = false;
  }

  const off = on(EV.ROOM_UPDATE, paint);
  const offLeft = on(EV.ROOM_LEFT, () => go('menu'));
  paint(room.current());

  /**
   * Секундный тик. Делает две вещи:
   *  1) обновляет цифру таймера на экране, не перерисовывая всё;
   *  2) если время фазы вышло — ТОЛЬКО ведущий шлёт переход,
   *     чтобы не было гонки из нескольких клиентов.
   */
  const tick = setInterval(() => {
    const state = room.current();
    if (!state || !state.game) return;

    // Обновляем видимую цифру таймера
    const left = secondsLeft(state);
    const valNode = wrap.querySelector('.timer__val');
    if (valNode && left !== null) {
      const mm = Math.floor(left / 60);
      const ss = left % 60;
      valNode.textContent = mm > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : `${ss}`;
      const chip = valNode.closest('.timer');
      if (chip) chip.classList.toggle('timer--low', left <= 10);
    }

    // Истечение обрабатывает только ведущий
    if (room.isHost(state) && deadlinePassed(state)) {
      send((fresh) => onDeadline(fresh));
    }
  }, 1000);

  // Боковая панель с чатом и личными заметками. Живёт только на
  // игровом экране: монтируется здесь, снимается в cleanup.
  const unmountSide = mountSidePanel();

  wrap.cleanup = () => {
    off(); offLeft(); clearTimeout(pendingTimer); clearInterval(tick);
    document.body.classList.remove('voting-alert');
    unmountSide();
  };
  return wrap;
}
