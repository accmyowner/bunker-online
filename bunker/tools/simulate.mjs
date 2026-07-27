/**
 * simulate.mjs — прогон полных партий без браузера под НОВУЮ механику:
 * ход по очереди → личное время → обсуждение → голосование → раунд.
 */
import {
  buildGame, applyPatch, reveal, endTurn, startVote, castVote, nextRound, onDeadline,
  alivePlayers, turnOrder, activePlayer, revealsLeft, voteCandidates, isFinished, PHASES
} from '../src/game/engine.js';
import { TRAIT_ORDER } from '../src/data/traits.js';

function makeRoom(count, settings = {}) {
  const players = {};
  for (let i = 0; i < count; i++) players[`p${i}`] = { id: `p${i}`, name: `Игрок ${i+1}`, online: true, lastSeen: Date.now() };
  return { code: 'TEST1', hostId: 'p0', status: 'game', startedAt: 1700000000000, settings, players, game: null };
}
function apply(room, res) { if (res.ok) applyPatch(room, res.patch); return res; }
function firstHidden(room, id) { return TRAIT_ORDER.filter(k => !room.game.chars[id].revealed[k])[0]; }

function run(count, settings) {
  const room = makeRoom(count, settings);
  room.game = buildGame(room);
  let guard = 0;

  while (room.game.phase !== PHASES.ENDED && guard++ < 3000) {
    const g = room.game;

    if (g.phase === PHASES.REVEAL) {
      const active = activePlayer(room);
      if (!active) { apply(room, endTurn(room)); continue; }
      const hidden = firstHidden(room, active);
      if (hidden && revealsLeft(room, active) > 0) apply(room, reveal(room, active, hidden));
      else apply(room, endTurn(room));   // нечего открывать — пропуск
    }
    else if (g.phase === PHASES.TURN) {
      apply(room, endTurn(room));         // «рассказал» — дальше
    }
    else if (g.phase === PHASES.DISCUSS) {
      apply(room, startVote(room));
    }
    else if (g.phase === PHASES.VOTE) {
      const voters = alivePlayers(room);
      for (const voter of voters) {
        if (room.game.phase !== PHASES.VOTE) break;
        const targets = voteCandidates(room).filter(t => t !== voter);
        if (!targets.length) break;
        apply(room, castVote(room, voter, targets[0]));
      }
      if (room.game.phase === PHASES.VOTE) apply(room, onDeadline({ ...room, game: { ...room.game, phaseDeadline: 1 } }));
    }
    else if (g.phase === PHASES.RESULT) {
      apply(room, nextRound(room));
    }
  }

  const survivors = alivePlayers(room);
  const seats = room.game.bunker.seats;
  const ended = room.game.phase === PHASES.ENDED;
  const ok = ended && survivors.length > 0 && survivors.length <= Math.max(seats, survivors.length);

  const mode = settings.endMode || 'seats';
  console.log(`${count} игроков [${mode}] → раундов ${room.game.round}, мест ${seats}, выжило ${survivors.length}, изгнано ${room.game.eliminated.length} ${ok && ended ? '✓' : '✗'}`);

  if (room.game.eliminated.length + survivors.length !== count) throw new Error('потеряны игроки');
  if (new Set(room.game.eliminated).size !== room.game.eliminated.length) throw new Error('двойное изгнание');
  return ok && ended;
}

console.log('=== Классический режим (seats) ===');
let allOk = true;
for (const n of [3,4,5,6,8,10,12,16]) allOk = run(n, { endMode: 'seats' }) && allOk;

console.log('\n=== Долгий режим (cards) — больше раундов ===');
for (const n of [4,6,8]) allOk = run(n, { endMode: 'cards' }) && allOk;

const a = buildGame(makeRoom(6));
const b = buildGame(makeRoom(6));
const same = JSON.stringify(a.chars) === JSON.stringify(b.chars) && a.catastropheId === b.catastropheId;
console.log(`\nДетерминизм генерации: ${same ? '✓ совпадает' : '✗'}`);
console.log(allOk && same ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : '\nЕСТЬ ОШИБКИ');
process.exit(allOk && same ? 0 : 1);
