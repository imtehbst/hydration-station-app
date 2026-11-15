// Shark Drop bot. Easy drops anywhere, Medium takes wins and blocks yours,
// Hard also looks several moves ahead.
import { COLS, ROWS, boardOf, canDrop, lineThrough, createGame, joinGame } from './rules.js';
import { botPlayer, pick } from '../shared/bots.js';

const ORDER = [3, 2, 4, 1, 5, 0, 6]; // centre columns first

// Drop a piece on a plain board array; returns the row it landed in, or -1 if full.
function put(b, col, seat) {
  for (let r = ROWS - 1; r >= 0; r--) if (b[r * COLS + col] === null) { b[r * COLS + col] = seat; return r; }
  return -1;
}
const wins = (b, col, seat) => {
  const r = put(b, col, seat);
  if (r < 0) return false;
  const won = Boolean(lineThrough(b, r, col));
  b[r * COLS + col] = null;
  return won;
};

// Every run of four squares on the board, worked out once.
const WINDOWS = (() => {
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
      if (cells.every(([a, d]) => a >= 0 && a < ROWS && d >= 0 && d < COLS)) out.push(cells.map(([a, d]) => a * COLS + d));
    }
  }
  return out;
})();

// How good the board looks for `me`: open twos and threes, and pieces in the centre.
function evaluate(b, me) {
  let v = 0;
  for (const w of WINDOWS) {
    let mine = 0, theirs = 0;
    for (const i of w) { if (b[i] === me) mine++; else if (b[i] !== null) theirs++; }
    if (mine && theirs) continue;
    if (mine === 3) v += 6; else if (mine === 2) v += 2;
    if (theirs === 3) v -= 7; else if (theirs === 2) v -= 2;
  }
  for (let r = 0; r < ROWS; r++) if (b[r * COLS + 3] === me) v += 1;
  return v;
}

function search(b, me, turn, depth, alpha, beta) {
  let any = false;
  let best = turn === me ? -Infinity : Infinity;
  for (const c of ORDER) {
    const r = put(b, c, turn);
    if (r < 0) continue;
    any = true;
    let v;
    if (lineThrough(b, r, c)) v = turn === me ? 1000 + depth : -1000 - depth;
    else if (depth === 0) v = evaluate(b, me);
    else v = search(b, me, 1 - turn, depth - 1, alpha, beta);
    b[r * COLS + c] = null;
    if (turn === me) { if (v > best) best = v; if (v > alpha) alpha = v; } else { if (v < best) best = v; if (v < beta) beta = v; }
    if (beta <= alpha) break;
  }
  return any ? best : 0; // board full: a draw
}

export function chooseMove(s, seat, level, rng = Math.random) {
  const b = boardOf(s);
  const open = ORDER.filter((c) => canDrop(s, c));
  if (level === 'easy') return pick(open, rng);
  const win = open.find((c) => wins(b, c, seat));
  if (win !== undefined) return win;
  const block = open.find((c) => wins(b, c, 1 - seat));
  if (block !== undefined) return block;
  if (level === 'medium') {
    // don't drop where the other side could then win on top of it
    const safe = open.filter((c) => { const r = put(b, c, seat); const bad = open.some((d) => wins(b, d, 1 - seat)); b[r * COLS + c] = null; return !bad; });
    const from = safe.length ? safe : open;
    return rng() < 0.5 ? from[0] : pick(from, rng);
  }
  let best = -Infinity;
  let bests = [];
  for (const c of open) {
    const r = put(b, c, seat);
    const v = lineThrough(b, r, c) ? 2000 : search(b, seat, 1 - seat, 5, -Infinity, Infinity);
    b[r * COLS + c] = null;
    if (v > best) { best = v; bests = [c]; } else if (v === best) bests.push(c);
  }
  return pick(bests, rng);
}

// A fresh game against a bot: you play the sharks and go first.
export function newBotGame(me, level, round = 1) {
  return joinGame(createGame(me, {}, round), botPlayer(level));
}
