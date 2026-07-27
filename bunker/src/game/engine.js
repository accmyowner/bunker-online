/**
 * engine.js — правила игры.
 *
 * Модуль намеренно состоит из чистых функций: он принимает
 * состояние комнаты и возвращает новое. Ничего не знает ни про DOM,
 * ни про сеть. Благодаря общему зерну все клиенты приходят
 * к одинаковому результату, и синхронизировать нужно только действия.
 */
import { createRng, seedFrom, pick, sample, shuffle, intBetween } from '../core/rng.js';
import { TRAIT_ORDER, TRAIT_POOLS, SPECIALS, AGE_RANGE } from '../data/traits.js';
import { CATASTROPHES } from '../data/catastrophes.js';
import { DURATIONS, FOOD, WATER, MEDICINE, ROOMS, QUIRKS, seatsFor } from '../data/bunkers.js';

export const PHASES = {
  REVEAL:  'reveal',   // активный игрок открывает карту
  TURN:    'turn',     // личное время рассказа активного игрока
  DISCUSS: 'discuss',  // общее обсуждение
  VOTE:    'vote',
  RESULT:  'result',
  ENDED:   'ended'
};

export const PHASE_META = {
  reveal:  { title: 'Ход игрока',       desc: 'Активный игрок открывает одну карту' },
  turn:    { title: 'Рассказ',          desc: 'Игрок рассказывает о своей характеристике' },
  discuss: { title: 'Обсуждение',       desc: 'Общий разговор перед голосованием' },
  vote:    { title: 'Голосование',      desc: 'Выберите, кого не пускать в бункер' },
  result:  { title: 'Итог раунда',      desc: 'Голоса подсчитаны' },
  ended:   { title: 'Игра завершена',   desc: 'Состав бункера определён' }
};

/** Сколько карт нужно открыть в этом раунде */
/**
 * Сколько новых карт игрок открывает за раунд.
 *
 * По одной в каждом раунде, включая первый. Раунды идут, пока не
 * будут открыты все характеристики или игра не закончится по правилам.
 */
export function revealQuota(round) {
  return 1;
}

/* ============================================================
   НАСТРОЙКИ ВРЕМЕНИ И РЕЖИМА
   Значения в секундах. 0 = без ограничения.
   Списки вариантов используются экраном настроек лобби.
   ============================================================ */

export const TURN_TIME_OPTIONS = [
  { value: 15,  label: '15 сек' },
  { value: 30,  label: '30 сек' },
  { value: 45,  label: '45 сек' },
  { value: 60,  label: '1 минута' },
  { value: 120, label: '2 минуты' },
  { value: 0,   label: 'Без ограничения' }
];

export const DISCUSS_TIME_OPTIONS = [
  { value: 30,  label: '30 сек' },
  { value: 60,  label: '1 минута' },
  { value: 120, label: '2 минуты' },
  { value: 180, label: '3 минуты' },
  { value: 300, label: '5 минут' },
  { value: 0,   label: 'Без ограничения' }
];

export const VOTE_TIME_OPTIONS = [
  { value: 15,  label: '15 сек' },
  { value: 30,  label: '30 сек' },
  { value: 60,  label: '1 минута' },
  { value: 120, label: '2 минуты' },
  { value: 0,   label: 'Без ограничения' }
];

/** До какого момента игра длится */
export const END_MODE_OPTIONS = [
  { value: 'seats',    label: 'До заполнения бункера', desc: 'Классика: пока живых не станет столько же, сколько мест' },
  { value: 'cards',    label: 'Раскрыть почти все карты', desc: 'Долгая партия: раунды идут, пока не откроется большинство характеристик' }
];

/** Настройки времени по умолчанию — применяются, если ведущий ничего не менял */
export const DEFAULT_TIMING = {
  turnSeconds: 45,
  discussSeconds: 120,
  voteSeconds: 60,
  endMode: 'seats'
};

/** Достаёт настройки времени из комнаты, подставляя значения по умолчанию */
export function timing(room) {
  const s = room.settings || {};
  return {
    turnSeconds:    s.turnSeconds    ?? DEFAULT_TIMING.turnSeconds,
    discussSeconds: s.discussSeconds ?? DEFAULT_TIMING.discussSeconds,
    voteSeconds:    s.voteSeconds    ?? DEFAULT_TIMING.voteSeconds,
    endMode:        s.endMode        ?? DEFAULT_TIMING.endMode
  };
}

/** Дедлайн фазы: текущее время + длительность. 0 секунд = без дедлайна (null). */
function deadlineFor(seconds) {
  return seconds > 0 ? Date.now() + seconds * 1000 : null;
}

/* ============================================================
   ГЕНЕРАЦИЯ
   ============================================================ */

/** Собирает персонажа из пулов. Спец-карта всегда одна. */
function buildCharacter(rng) {
  const traits = {};
  for (const key of TRAIT_ORDER) {
    if (key === 'age') {
      traits.age = `${intBetween(rng, AGE_RANGE.min, AGE_RANGE.max)} лет`;
    } else if (key === 'special') {
      traits.special = pick(rng, SPECIALS).text;
    } else {
      traits[key] = pick(rng, TRAIT_POOLS[key]);
    }
  }
  return { traits, revealed: {} };
}

/** Собирает бункер: срок, запасы, помещения и одну странность */
function buildBunker(rng, playerCount) {
  const chosen = sample(rng, ROOMS, intBetween(rng, 5, 8));
  const rooms = chosen.map((room) => {
    const broken = rng() < 0.35;
    return {
      id: room.id,
      name: room.name,
      icon: room.icon,
      status: broken ? room.bad : room.good,
      ok: !broken
    };
  });

  return {
    seats: seatsFor(playerCount),
    duration: pick(rng, DURATIONS),
    food: pick(rng, FOOD),
    water: pick(rng, WATER),
    medicine: pick(rng, MEDICINE),
    rooms,
    quirk: pick(rng, QUIRKS)
  };
}

/**
 * Создаёт партию. Зерно выводится из кода комнаты и метки времени,
 * поэтому переподключившийся игрок получит ровно те же карты.
 */
export function buildGame(room) {
  const ids = Object.keys(room.players);
  const seedText = `${room.code}:${room.startedAt || 0}`;
  const seed = seedFrom(seedText);
  const rng = createRng(seed);

  const catastrophe = pick(rng, CATASTROPHES);
  const bunker = buildBunker(rng, ids.length);

  const chars = {};
  // Порядок важен: сортируем, чтобы генерация не зависела от порядка ключей
  for (const id of ids.slice().sort()) chars[id] = buildCharacter(rng);

  return {
    seed,
    catastropheId: catastrophe.id,
    bunker,
    round: 1,
    phase: PHASES.REVEAL,
    order: shuffle(rng, ids.slice().sort()),
    activeIndex: 0,          // чей сейчас ход (индекс в order среди живых)
    phaseDeadline: null,     // метка времени конца текущей фазы (null = без таймера)
    chars,
    roundReveals: {},
    votes: {},
    voteRound: 1,
    candidates: null,
    eliminated: [],
    lastEliminated: null,
    log: [logEntry('Гермозатвор закрыт. Раунд 1 начался.', 'info')]
  };
}

export function logEntry(text, kind = 'info') {
  return { t: Date.now(), text, kind };
}

/* ============================================================
   ЗАПРОСЫ К СОСТОЯНИЮ
   ============================================================ */

export function alivePlayers(room) {
  const eliminated = new Set(room.game?.eliminated || []);
  return (room.game?.order || Object.keys(room.players))
    .filter((id) => room.players[id] && !eliminated.has(id));
}

export function isAlive(room, playerId) {
  return !(room.game?.eliminated || []).includes(playerId);
}

/** Сколько карт игрок уже открыл в текущем раунде */
export function revealedThisRound(room, playerId) {
  return room.game?.roundReveals?.[playerId] || 0;
}

export function revealsLeft(room, playerId) {
  if (!isAlive(room, playerId)) return 0;
  return Math.max(0, revealQuota(room.game.round) - revealedThisRound(room, playerId));
}

/** Все ли выполнили норму раскрытия */
/** Живые игроки в порядке очереди раунда */
export function turnOrder(room) {
  const alive = new Set(alivePlayers(room));
  return (room.game?.order || []).filter((id) => alive.has(id));
}

/** Кто сейчас ходит (id активного игрока) */
export function activePlayer(room) {
  const order = turnOrder(room);
  const idx = room.game?.activeIndex ?? 0;
  return order[idx] || null;
}

/** Это ход данного игрока прямо сейчас? */
export function isActiveTurn(room, playerId) {
  return activePlayer(room) === playerId;
}

/** Сколько секунд осталось до конца фазы (для отображения) */
export function secondsLeft(room) {
  const deadline = room.game?.phaseDeadline;
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/** Истёк ли дедлайн текущей фазы */
export function deadlinePassed(room) {
  const deadline = room.game?.phaseDeadline;
  return Boolean(deadline) && Date.now() >= deadline;
}

/** Сколько карт всего у персонажа (для режима «раскрыть почти все») */
function traitCount() {
  return TRAIT_ORDER.length;
}

/** Средняя доля раскрытых карт среди живых игроков */
function revealedFraction(room) {
  const alive = alivePlayers(room);
  if (!alive.length) return 1;
  const total = alive.length * traitCount();
  let opened = 0;
  for (const id of alive) opened += Object.keys(room.game.chars[id]?.revealed || {}).length;
  return opened / total;
}

export function everyoneRevealed(room) {
  return alivePlayers(room).every((id) => revealsLeft(room, id) === 0);
}

export function everyoneVoted(room) {
  const voters = alivePlayers(room);
  return voters.every((id) => room.game.votes[id]);
}

/** Кандидаты на изгнание: либо все живые, либо переголосование среди спорных */
export function voteCandidates(room) {
  return room.game.candidates || alivePlayers(room);
}

/** Подсчёт голосов: { targetId: count } */
export function tally(room) {
  const counts = {};
  for (const target of Object.values(room.game.votes)) {
    counts[target] = (counts[target] || 0) + 1;
  }
  return counts;
}

/**
 * Игра окончена. Зависит от режима из настроек:
 *   seats — классика: живых осталось столько же, сколько мест;
 *   cards — долгая партия: тянем, пока не раскрыто большинство карт,
 *           но всё равно нельзя оставить меньше игроков, чем мест.
 */
export function isFinished(room) {
  const alive = alivePlayers(room).length;
  const seats = room.game.bunker.seats;
  if (alive <= seats) return true;              // мест не больше, чем людей — всегда конец

  if (timing(room).endMode === 'cards') {
    // В долгом режиме продолжаем, пока раскрыто меньше ~85% карт
    // и пока есть кого исключать сверх числа мест
    return revealedFraction(room) >= 0.85;
  }
  return false;
}

/* ============================================================
   ДЕЙСТВИЯ (возвращают патч для записи в сеть)
   ============================================================ */

/**
 * Активный игрок открывает свою характеристику.
 * Ход строго по очереди: открыть карту может только тот, чей ход.
 * После раскрытия начинается его личное время рассказа (фаза TURN).
 */
export function reveal(room, playerId, traitKey) {
  const game = room.game;
  if (game.phase !== PHASES.REVEAL) return { ok: false, reason: 'Сейчас не этап раскрытия' };
  if (!isAlive(room, playerId)) return { ok: false, reason: 'Вы уже вне игры' };
  if (!isActiveTurn(room, playerId)) return { ok: false, reason: 'Сейчас не ваш ход' };
  if (game.chars[playerId]?.revealed?.[traitKey]) return { ok: false, reason: 'Уже открыто' };
  if (revealsLeft(room, playerId) <= 0) return { ok: false, reason: 'В этом раунде вы уже открыли карту' };

  const name = room.players[playerId]?.name || 'Игрок';
  const value = game.chars[playerId].traits[traitKey];
  const t = timing(room);

  const nextLog = game.log.concat(logEntry(`${name}: ${value}`, 'reveal')).slice(-60);

  const patch = {
    [`game/chars/${playerId}/revealed/${traitKey}`]: true,
    [`game/roundReveals/${playerId}`]: revealedThisRound(room, playerId) + 1,
    // Сразу после раскрытия — личное время рассказа этого игрока
    'game/phase': PHASES.TURN,
    'game/phaseDeadline': deadlineFor(t.turnSeconds),
    'game/log': nextLog
  };

  return { ok: true, patch };
}

/**
 * Завершить текущий ход и передать очередь дальше.
 * Вызывается по истечении таймера рассказа (ведущим) или досрочно
 * кнопкой «Дальше». Когда очередь закончилась — общее обсуждение.
 */
export function endTurn(room) {
  const game = room.game;
  if (game.phase !== PHASES.TURN && game.phase !== PHASES.REVEAL) {
    return { ok: false, reason: 'Сейчас не ход игрока' };
  }
  const order = turnOrder(room);
  const nextIndex = (game.activeIndex ?? 0) + 1;
  const t = timing(room);

  // Ещё есть игроки в очереди — передаём ход следующему
  if (nextIndex < order.length) {
    const nextName = room.players[order[nextIndex]]?.name || 'Игрок';
    return {
      ok: true,
      patch: {
        'game/activeIndex': nextIndex,
        'game/phase': PHASES.REVEAL,
        'game/phaseDeadline': null,
        'game/log': game.log.concat(logEntry(`Ход переходит к ${nextName}.`, 'info')).slice(-60)
      }
    };
  }

  // Очередь закончена — начинается общее обсуждение
  return {
    ok: true,
    patch: {
      'game/phase': PHASES.DISCUSS,
      'game/phaseDeadline': deadlineFor(t.discussSeconds),
      'game/log': game.log.concat(logEntry('Все высказались. Общее обсуждение.', 'info')).slice(-60)
    }
  };
}

/** Переход от обсуждения к голосованию */
export function startVote(room) {
  const t = timing(room);
  return {
    ok: true,
    patch: {
      'game/phase': PHASES.VOTE,
      'game/phaseDeadline': deadlineFor(t.voteSeconds),
      'game/votes': {},
      'game/log': room.game.log.concat(logEntry('Голосование открыто.', 'alarm')).slice(-60)
    }
  };
}

/** Игрок отдаёт голос */
export function castVote(room, voterId, targetId) {
  const game = room.game;
  if (game.phase !== PHASES.VOTE) return { ok: false, reason: 'Голосование закрыто' };
  if (!isAlive(room, voterId)) return { ok: false, reason: 'Вы уже вне игры' };
  if (!voteCandidates(room).includes(targetId)) return { ok: false, reason: 'Этот игрок не в списке' };

  const patch = { [`game/votes/${voterId}`]: targetId };

  const preview = applyPatch(structuredClone(room), patch);
  if (everyoneVoted(preview)) {
    Object.assign(patch, resolveVote(preview).patch);
  }
  return { ok: true, patch };
}

/**
 * Обработка истёкшего таймера фазы. Вызывает ТОЛЬКО ведущий —
 * иначе несколько клиентов одновременно запишут переход.
 * Возвращает патч перехода или { ok: false }, если делать нечего.
 */
export function onDeadline(room) {
  const game = room.game;
  if (!deadlinePassed(room)) return { ok: false, reason: 'Время ещё не вышло' };

  switch (game.phase) {
    case PHASES.TURN:
      // Личное время вышло — передаём ход дальше
      return endTurn(room);

    case PHASES.DISCUSS:
      // Обсуждение закончилось — открываем голосование
      return startVote(room);

    case PHASES.VOTE: {
      // Время вышло: подводим итог по уже поданным голосам.
      // Если не проголосовал никто — засчитываем воздержавшихся
      // и просто переходим дальше без изгнания.
      if (Object.keys(game.votes || {}).length === 0) {
        return {
          ok: true,
          patch: {
            'game/phase': PHASES.RESULT,
            'game/phaseDeadline': null,
            'game/lastEliminated': null,
            'game/log': game.log.concat(logEntry('Никто не проголосовал. Раунд без изгнания.', 'alarm')).slice(-60)
          }
        };
      }
      return resolveVote(room);
    }

    default:
      return { ok: false, reason: 'В этой фазе нет таймера' };
  }
}

/**
 * Подводит итог голосования.
 * Ничья решается переголосованием среди лидеров; если ничья
 * повторяется — выбор делает детерминированный жребий,
 * одинаковый у всех клиентов.
 */
export function resolveVote(room) {
  const game = room.game;
  const counts = tally(room);
  const max = Math.max(...Object.values(counts), 0);
  const leaders = Object.keys(counts).filter((id) => counts[id] === max);

  const log = game.log.slice();

  if (leaders.length > 1 && game.voteRound < 2) {
    const names = leaders.map((id) => room.players[id]?.name || '?').join(', ');
    log.push(logEntry(`Ничья: ${names}. Переголосование.`, 'alarm'));
    return {
      ok: true,
      patch: {
        'game/votes': {},
        'game/voteRound': game.voteRound + 1,
        'game/candidates': leaders,
        'game/phaseDeadline': deadlineFor(timing(room).voteSeconds),
        'game/log': log.slice(-60)
      }
    };
  }

  let victim = leaders[0];
  if (leaders.length > 1) {
    const rng = createRng(game.seed + game.round * 7919 + game.voteRound);
    victim = leaders[Math.floor(rng() * leaders.length)];
    log.push(logEntry('Ничья повторилась. Решает жребий.', 'alarm'));
  }

  const victimName = room.players[victim]?.name || 'Игрок';
  log.push(logEntry(`${victimName} остаётся снаружи.`, 'alarm'));

  const patch = {
    'game/eliminated': game.eliminated.concat(victim),
    'game/lastEliminated': victim,
    'game/phase': PHASES.RESULT,
    'game/phaseDeadline': null,
    'game/candidates': null,
    'game/voteRound': 1,
    'game/log': log.slice(-60)
  };

  return { ok: true, patch };
}

/** Переход к следующему раунду или к финалу */
export function nextRound(room) {
  const preview = room;
  if (isFinished(preview)) {
    const survivors = alivePlayers(preview)
      .map((id) => preview.players[id]?.name || '?')
      .join(', ');
    return {
      ok: true,
      patch: {
        'game/phase': PHASES.ENDED,
        'status': 'ended',
        'game/log': preview.game.log
          .concat(logEntry(`Гермозатвор запечатан. Внутри: ${survivors}.`, 'good'))
          .slice(-60)
      }
    };
  }

  const round = preview.game.round + 1;
  return {
    ok: true,
    patch: {
      'game/round': round,
      'game/phase': PHASES.REVEAL,
      'game/activeIndex': 0,          // очередь начинается заново с первого живого
      'game/phaseDeadline': null,
      'game/roundReveals': {},
      'game/votes': {},
      'game/lastEliminated': null,
      'game/log': preview.game.log.concat(logEntry(`Раунд ${round}.`, 'info')).slice(-60)
    }
  };
}

/* ============================================================
   ПРИМЕНЕНИЕ ПАТЧЕЙ
   ============================================================ */

/**
 * Применяет плоский патч вида { 'game/phase': 'vote' } к объекту.
 * Тот же формат понимает Firebase, поэтому логика едина
 * для сетевого и локального режима.
 */
export function applyPatch(target, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split('/').filter(Boolean);
    let node = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      if (node[key] === null || typeof node[key] !== 'object') node[key] = {};
      node = node[key];
    }
    const last = parts[parts.length - 1];
    if (value === null) delete node[last];
    else node[last] = value;
  }
  return target;
}
