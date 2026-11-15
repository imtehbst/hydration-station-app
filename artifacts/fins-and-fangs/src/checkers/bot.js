// Coral Checkers bot. Easy moves at random, Medium avoids handing over a piece,
// Hard looks several moves ahead.
import { createGame, joinGame, legalMoves, move, ownerOf, isKing, N } from './rules.js';
import { botPlayer, pick } from '../shared/bots.js';

// Pieces count 3, kings 5, with a little extra for pieces that have advanced.
function evaluate(s, me) {
  let v = 0;
  s.board.forEach((p, i) => {
    if (!p) return;
    const seat = ownerOf(p), row = (i / N) | 0;
    const worth = isKing(p) ? 5 : 3 + (seat === 0 ? N - 1 - row : row) * 0.1;
    v += seat === me ? worth : -worth;
  });
  return v;
}

function search(s, me, depth, alpha, beta) {
  if (s.status === 'over') return s.winner === 'draw' ? 0 : s.winner === me ? 1000 + depth : -1000 - depth;
  if (depth <= 0) return evaluate(s, me);
  const mine = s.turn === me;
  let best = mine ? -Infinity : Infinity;
  for (const m of legalMoves(s)) {
    const g = move(s, s.turn, m, s.turnNo);
    // the rest of a multi-jump doesn't use up a level of look-ahead
    const v = search(g, me, g.turn === s.turn && g.status === 'playing' ? depth : depth - 1, alpha, beta);
    if (mine) { if (v > best) best = v; if (v > alpha) alpha = v; } else { if (v < best) best = v; if (v < beta) beta = v; }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseMove(s, seat, level, rng = Math.random) {
  const moves = legalMoves(s, seat);
  if (level === 'easy' || moves.length === 1) return pick(moves, rng);
  const depth = level === 'hard' ? 7 : 3; // how many moves ahead it looks
  let best = -Infinity, bests = [];
  for (const m of moves) {
    const g = move(s, seat, m, s.turnNo);
    const v = search(g, seat, g.turn === seat && g.status === 'playing' ? depth : depth - 1, -Infinity, Infinity);
    if (v > best) { best = v; bests = [m]; } else if (v === best) bests.push(m);
  }
  return pick(bests, rng);
}

export function newBotGame(me, level, round = 1) {
  return joinGame(createGame(me, {}, round), botPlayer(level));
}
