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
  REVEAL:  'reveal',
  DISCUSS: 'discuss',
  VOTE:    'vote',
  RESULT:  'result',
  ENDED:   'ended'
};

export const PHASE_META = {
  reveal:  { title: 'Раскрытие карт',   desc: 'Откройте нужное число характеристик' },
  discuss: { title: 'Обсуждение',       desc: 'Договоритесь, кто останется снаружи' },
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

/** Игра окончена, когда живых осталось ровно столько, сколько мест */
export function isFinished(room) {
  return alivePlayers(room).length <= room.game.bunker.seats;
}

/* ============================================================
   ДЕЙСТВИЯ (возвращают патч для записи в сеть)
   ============================================================ */

/** Игрок открывает свою характеристику */
export function reveal(room, playerId, traitKey) {
  const game = room.game;
  if (game.phase !== PHASES.REVEAL) return { ok: false, reason: 'Сейчас не этап раскрытия' };
  if (!isAlive(room, playerId)) return { ok: false, reason: 'Вы уже вне игры' };
  if (game.chars[playerId]?.revealed?.[traitKey]) return { ok: false, reason: 'Уже открыто' };
  if (revealsLeft(room, playerId) <= 0) return { ok: false, reason: 'Норма раунда исчерпана' };

  const name = room.players[playerId]?.name || 'Игрок';
  const value = game.chars[playerId].traits[traitKey];

  const patch = {
    [`game/chars/${playerId}/revealed/${traitKey}`]: true,
    [`game/roundReveals/${playerId}`]: revealedThisRound(room, playerId) + 1
  };

  const nextLog = game.log.concat(logEntry(`${name}: ${value}`, 'reveal')).slice(-60);
  patch['game/log'] = nextLog;

  // Локально применяем, чтобы проверить, не пора ли менять фазу
  const preview = applyPatch(structuredClone(room), patch);
  if (everyoneRevealed(preview)) {
    patch['game/phase'] = PHASES.DISCUSS;
    patch['game/log'] = nextLog.concat(
      logEntry('Все карты этого раунда открыты. Переходите к обсуждению.', 'info')
    ).slice(-60);
  }

  return { ok: true, patch };
}

/** Ведущий переводит стол от обсуждения к голосованию */
export function startVote(room) {
  return {
    ok: true,
    patch: {
      'game/phase': PHASES.VOTE,
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
