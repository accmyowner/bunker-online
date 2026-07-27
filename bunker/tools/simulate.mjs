/**
 * simulate.mjs — прогон партий под финальную механику:
 * раскрытие по кругам без голосований → финальная серия голосований.
 */
import {
  buildGame, applyPatch, reveal, endTurn, advanceAfterDiscuss, castVote, nextRound, onDeadline,
  alivePlayers, activePlayer, revealsLeft, voteCandidates, revealDone, PHASES
} from '../src/game/engine.js';
import { TRAIT_ORDER } from '../src/data/traits.js';

function makeRoom(count, settings = {}) {
  const players = {};
  for (let i = 0; i < count; i++) players[`p${i}`] = { id: `p${i}`, name: `Игрок ${i+1}`, online: true, lastSeen: Date.now() };
  return { code: 'T', hostId: 'p0', status: 'game', startedAt: 1700000000000, settings, players, game: null };
}
function apply(room, res) { if (res.ok) applyPatch(room, res.patch); return res; }
function firstHidden(room, id) { return TRAIT_ORDER.filter(k => !room.game.chars[id].revealed[k])[0]; }

function run(count, settings) {
  const room = makeRoom(count, settings);
  room.game = buildGame(room);
  let guard = 0, voteBeforeReveal = false, revealRounds = 0;

  while (room.game.phase !== PHASES.ENDED && guard++ < 6000) {
    const g = room.game;
    if (g.phase === PHASES.REVEAL) {
      const a = activePlayer(room);
      if (!a) { apply(room, endTurn(room)); continue; }
      const h = firstHidden(room, a);
      if (h && revealsLeft(room, a) > 0) apply(room, reveal(room, a, h));
      else apply(room, endTurn(room));
    }
    else if (g.phase === PHASES.TURN) apply(room, endTurn(room));
    else if (g.phase === PHASES.DISCUSS) { revealRounds++; apply(room, advanceAfterDiscuss(room)); }
    else if (g.phase === PHASES.VOTE) {
      if (!room.game.finalVoting) voteBeforeReveal = true;
      for (const v of alivePlayers(room)) {
        if (room.game.phase !== PHASES.VOTE) break;
        const t = voteCandidates(room).filter(x => x !== v);
        if (t.length) apply(room, castVote(room, v, t[0]));
      }
      if (room.game.phase === PHASES.VOTE) { room.game.phaseDeadline = 1; apply(room, onDeadline(room)); }
    }
    else if (g.phase === PHASES.RESULT) apply(room, nextRound(room));
  }

  const alive = alivePlayers(room).length;
  const seats = room.game.bunker.seats;
  const ok = room.game.phase === PHASES.ENDED && alive === seats && !voteBeforeReveal;
  console.log(`${count} игроков [${settings.endMode||'long'}] → кругов раскрытия ${revealRounds}, изгнано ${room.game.eliminated.length}, выжило ${alive}/${seats} ${ok?'✓':'✗'}`);

  if (voteBeforeReveal) throw new Error('голосование до завершения раскрытия!');
  if (room.game.eliminated.length + alive !== count) throw new Error('потеряны игроки');
  if (new Set(room.game.eliminated).size !== room.game.eliminated.length) throw new Error('двойное изгнание');
  return ok;
}

console.log('=== Длинный режим ===');
let allOk = true;
for (const n of [3,4,5,6,8,10,12,16]) allOk = run(n, { endMode: 'long' }) && allOk;
console.log('\n=== Короткий режим ===');
for (const n of [4,6,8,12]) allOk = run(n, { endMode: 'short' }) && allOk;

console.log(allOk ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : '\nЕСТЬ ОШИБКИ');
process.exit(allOk ? 0 : 1);
