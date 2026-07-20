/**
 * simulate.mjs — прогон полной партии без браузера.
 * Проверяет, что фазы сменяются, голоса считаются и игра завершается.
 */
import {
  buildGame, applyPatch, reveal, startVote, castVote, nextRound,
  alivePlayers, revealsLeft, isAlive, voteCandidates, PHASES
} from '../src/game/engine.js';
import { TRAIT_ORDER } from '../src/data/traits.js';

function makeRoom(count) {
  const players = {};
  for (let i = 0; i < count; i++) {
    players[`p${i}`] = { id: `p${i}`, name: `Игрок ${i + 1}`, online: true, lastSeen: Date.now() };
  }
  return { code: 'TEST1', hostId: 'p0', status: 'game', startedAt: 1700000000000, players, game: null };
}

function run(playerCount) {
  const room = makeRoom(playerCount);
  room.game = buildGame(room);

  let guard = 0;
  while (room.game.phase !== PHASES.ENDED && guard++ < 400) {
    const game = room.game;

    if (game.phase === PHASES.REVEAL) {
      for (const id of alivePlayers(room)) {
        while (revealsLeft(room, id) > 0) {
          const hidden = TRAIT_ORDER.filter(k => !game.chars[id].revealed[k]);
          if (!hidden.length) break;
          const res = reveal(room, id, hidden[0]);
          if (!res.ok) throw new Error('reveal: ' + res.reason);
          applyPatch(room, res.patch);
        }
      }
      if (room.game.phase === PHASES.REVEAL) throw new Error('фаза не сменилась после раскрытия');
    }

    else if (game.phase === PHASES.DISCUSS) {
      applyPatch(room, startVote(room).patch);
    }

    else if (game.phase === PHASES.VOTE) {
      const voters = alivePlayers(room);
      for (const voter of voters) {
        if (room.game.phase !== PHASES.VOTE) break;
        const targets = voteCandidates(room).filter(t => t !== voter);
        if (!targets.length) break;
        // Все голосуют против первого доступного — гарантированное большинство
        const res = castVote(room, voter, targets[0]);
        if (!res.ok) throw new Error('vote: ' + res.reason);
        applyPatch(room, res.patch);
      }
    }

    else if (game.phase === PHASES.RESULT) {
      applyPatch(room, nextRound(room).patch);
    }
  }

  const survivors = alivePlayers(room);
  const seats = room.game.bunker.seats;
  const ok = room.game.phase === PHASES.ENDED && survivors.length <= seats && survivors.length > 0;

  console.log(
    `${playerCount} игроков → раундов ${room.game.round}, мест ${seats}, ` +
    `выжило ${survivors.length}, изгнано ${room.game.eliminated.length} ${ok ? '✓' : '✗ ОШИБКА'}`
  );

  // Проверка целостности
  if (room.game.eliminated.length + survivors.length !== playerCount)
    throw new Error('потерялись игроки');
  if (new Set(room.game.eliminated).size !== room.game.eliminated.length)
    throw new Error('игрок изгнан дважды');
  for (const id of Object.keys(room.players)) {
    const traits = room.game.chars[id].traits;
    for (const key of TRAIT_ORDER) {
      if (!traits[key]) throw new Error(`пустая характеристика ${key} у ${id}`);
    }
  }
  return ok;
}

console.log('=== Прогон партий ===');
let allOk = true;
for (const n of [3, 4, 5, 6, 8, 10, 12, 16]) allOk = run(n) && allOk;

// Детерминизм: одно зерно — одинаковые карты у всех клиентов
const a = buildGame(makeRoom(6));
const b = buildGame(makeRoom(6));
const same = JSON.stringify(a.chars) === JSON.stringify(b.chars)
          && a.catastropheId === b.catastropheId
          && JSON.stringify(a.bunker) === JSON.stringify(b.bunker);
console.log(`Детерминизм генерации: ${same ? '✓ совпадает' : '✗ РАСХОЖДЕНИЕ'}`);

console.log(allOk && same ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : '\nЕСТЬ ОШИБКИ');
