// Shark Tic Tac Toe bot. Easy plays anywhere, Medium wins or blocks when it
// can, Hard plays perfectly (minimax) and never loses.
import { LINES, createGame, joinGame, place } from './rules.js';
import { botPlayer, pick } from '../shared/bots.js';

const empties = (b) => b.map((x, i) => (x === null ? i : -1)).filter((i) => i >= 0);

// A square that completes a line for `seat`, or -1.
function finishing(b, seat) {
  for (const l of LINES) {
    const mine = l.filter((i) => b[i] === seat).length;
    const free = l.filter((i) => b[i] === null);
    if (mine === 2 && free.length === 1) return free[0];
  }
  return -1;
}

const won = (b, seat) => LINES.some((l) => l.every((i) => b[i] === seat));

// Score from `me`'s point of view: +10 win (sooner is better), -10 loss, 0 draw.
function minimax(b, me, turn, depth) {
  if (won(b, me)) return 10 - depth;
  if (won(b, 1 - me)) return depth - 10;
  const free = empties(b);
  if (!free.length) return 0;
  const scores = free.map((i) => {
    const nb = b.slice(); nb[i] = turn;
    return minimax(nb, me, 1 - turn, depth + 1);
  });
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

// ---- Vanishing mode: the board keeps changing, so look ahead by playing moves out ----

const after = (s, seat, cell) => place(s, seat, cell, s.turnNo);
// How good the position is for `me`, looking `depth` moves ahead (alpha-beta).
function lookAhead(s, me, depth, alpha, beta) {
  if (s.status === 'over') return s.winner === me ? 100 + depth : s.winner === 'draw' ? 0 : -100 - depth;
  if (depth === 0) return 0;
  const mine = s.turn === me;
  let best = mine ? -Infinity : Infinity;
  for (const i of empties(s.board)) {
    const v = lookAhead(after(s, s.turn, i), me, depth - 1, alpha, beta);
    if (mine) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (beta <= alpha) break;
  }
  return best;
}

function chooseVanishing(s, seat, level, rng) {
  const free = empties(s.board);
  if (level === 'easy') return pick(free, rng);
  const depth = level === 'hard' ? 6 : 2; // medium: take a win, don't hand one over
  let best = -Infinity;
  let bests = [];
  for (const i of free) {
    const v = lookAhead(after(s, seat, i), seat, depth - 1, -Infinity, Infinity);
    if (v > best) { best = v; bests = [i]; } else if (v === best) bests.push(i);
  }
  return pick(bests, rng);
}

export function chooseMove(s, seat, level, rng = Math.random) {
  if (s.mode === 'three') return chooseVanishing(s, seat, level, rng);
  const b = s.board;
  const free = empties(b);
  if (level === 'easy') return pick(free, rng);
  if (level === 'medium') {
    const win = finishing(b, seat);
    if (win >= 0) return win;
    const block = finishing(b, 1 - seat);
    if (block >= 0) return block;
    if (b[4] === null && rng() < 0.6) return 4;
    return pick(free, rng);
  }
  let best = -Infinity;
  let bests = [];
  for (const i of free) {
    const nb = b.slice(); nb[i] = seat;
    const v = minimax(nb, seat, 1 - seat, 1);
    if (v > best) { best = v; bests = [i]; } else if (v === best) bests.push(i);
  }
  return pick(bests, rng);
}

// A fresh game against a bot: you play the sharks and go first.
export function newBotGame(me, level, round = 1, mode = 'classic') {
  return joinGame(createGame(me, {}, round, mode), botPlayer(level));
}
