// Fishing Nets bot. Easy draws anywhere. Medium takes any fish on offer and
// avoids setting one up. Hard also gives away the smallest catch when it must.
import { createGame, joinGame, move, sidesDrawn, boxesBy } from './rules.js';
import { botPlayer, pick } from '../shared/bots.js';

function allMoves(s) {
  const out = [];
  s.hz.forEach((x, i) => { if (x === null) out.push(['hz', i]); });
  s.vt.forEach((x, i) => { if (x === null) out.push(['vt', i]); });
  return out;
}
const completes = (s, m) => boxesBy(s.n, m[0], m[1]).some(([r, c]) => sidesDrawn(s, r, c) === 3);
const setsUp = (s, m) => boxesBy(s.n, m[0], m[1]).some(([r, c]) => sidesDrawn(s, r, c) === 2);

// How many fish the other side could take in a row after this line is drawn.
function giveaway(s, seat, m) {
  let g = move(s, seat, m, s.turnNo), n = 0;
  for (let guard = 0; guard < 60 && g.status === 'playing'; guard++) {
    const take = allMoves(g).find((x) => completes(g, x));
    if (!take) break;
    g = move(g, g.turn, take, g.turnNo); n++;
  }
  return n;
}

export function chooseMove(s, seat, level, rng = Math.random) {
  const moves = allMoves(s);
  if (level === 'easy') return pick(moves, rng);
  const takes = moves.filter((m) => completes(s, m));
  if (takes.length) return pick(takes, rng);
  const safe = moves.filter((m) => !setsUp(s, m));
  if (safe.length) return pick(safe, rng);
  if (level === 'medium') return pick(moves, rng);
  let best = Infinity, bests = [];
  for (const m of moves) { const g = giveaway(s, seat, m); if (g < best) { best = g; bests = [m]; } else if (g === best) bests.push(m); }
  return pick(bests, rng);
}

export function newBotGame(me, level, round = 1, opts = {}) {
  return joinGame(createGame(me, {}, round, opts), botPlayer(level));
}
