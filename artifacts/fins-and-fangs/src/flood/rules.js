// Color Tide — pure rules (a colour-flood territory game). You start in the
// bottom-left corner, your friend in the top-right. On your turn you pick a
// colour: your whole patch turns that colour and swallows every touching square
// of it. You can't pick your own colour or the other player's. The game runs until
// every square belongs to someone; the bigger patch wins. Never mutates inputs.
import { baseGame, canJoin, finish, baseValid, seatOf } from '../shared/base.js';

export { seatOf };
export const COLORS = 6;
export const SIZES = { small: { w: 8, h: 6, label: 'Small' }, medium: { w: 12, h: 8, label: 'Medium' }, large: { w: 16, h: 10, label: 'Large' } };
const sizeOf = (opts) => (SIZES[opts?.size] ? opts.size : 'medium');

// Each player's corner square.
export const cornerOf = (s, seat) => (seat === 0 ? (s.h - 1) * s.w : s.w - 1);
export const colorOf = (s, seat) => Number(s.cells[cornerOf(s, seat)]);

// The squares in a player's patch: everything joined to their corner in their colour.
export function patchOf(s, seat) {
  const start = cornerOf(s, seat), col = s.cells[start], seen = new Set([start]), stack = [start];
  while (stack.length) {
    const i = stack.pop(), x = i % s.w, y = (i / s.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
      const j = ny * s.w + nx;
      if (!seen.has(j) && s.cells[j] === col) { seen.add(j); stack.push(j); }
    }
  }
  return seen;
}
export const sizeOfPatch = (s, seat) => patchOf(s, seat).size;

// A fresh sea: no two touching squares share a colour, so both players start with one square.
export function deal(w, h, rng = Math.random) {
  const cells = [];
  for (let i = 0; i < w * h; i++) {
    const left = i % w ? cells[i - 1] : -1, up = i >= w ? cells[i - w] : -1;
    let c;
    do { c = Math.floor(rng() * COLORS) % COLORS; } while (c === left || c === up);
    cells.push(c);
  }
  const a = (h - 1) * w, b = w - 1;
  // the two corners must differ, without breaking the "no touching twins" rule beside the top-right corner
  while (cells[b] === cells[a] || cells[b] === cells[b - 1] || cells[b] === cells[b + w]) cells[b] = (cells[b] + 1) % COLORS;
  return cells.join('');
}

export function createGame(creator, score = {}, round = 1, opts = {}, rng = Math.random) {
  const size = sizeOf(opts), { w, h } = SIZES[size];
  return { ...baseGame(creator, score, round), size, w, h, cells: deal(w, h, rng), last: null };
}

export function joinGame(s, p) {
  if (!canJoin(s, p)) throw new Error('cannot join');
  return { ...s, status: 'playing', seats: [s.seats[0], p] };
}

export const isMyTurn = (s, uid) => { const seat = seatOf(s, uid); return Boolean(s && seat !== null && s.status === 'playing' && s.turn === seat); };
export const canMove = (s, seat, m) => Boolean(s && s.status === 'playing' && s.turn === seat && Number.isInteger(m) && m >= 0 && m < COLORS
  && m !== colorOf(s, seat) && m !== colorOf(s, 1 - seat));

// The sea after this player's patch turns colour m (the patch grows on its own: touching squares of m now match).
export function recolor(s, seat, m) {
  const cells = s.cells.split('');
  for (const i of patchOf(s, seat)) cells[i] = String(m);
  return cells.join('');
}

const isDone = (s, a, b) => a + b === s.w * s.h || s.turnNo >= s.w * s.h * 4;

export function move(s, seat, m, expectedTurnNo) {
  if (expectedTurnNo !== s.turnNo || !canMove(s, seat, m)) throw new Error('illegal move');
  const next = { ...s, cells: recolor(s, seat, m), turnNo: s.turnNo + 1, turn: 1 - seat, last: m };
  const a = sizeOfPatch(next, 0), b = sizeOfPatch(next, 1);
  // played out to the last square (with a move limit so a game can never go on for ever)
  if (isDone(next, a, b)) return finish(next, a === b ? 'draw' : a > b ? 0 : 1);
  return next;
}

export function rematch(s, rng = Math.random) {
  if (s.status !== 'over') throw new Error('game not over');
  const first = 1 - s.first;
  return { ...createGame(s.seats[0], s.score, (s.round || 1) + 1, { size: s.size }, rng), status: 'playing', seats: s.seats, turn: first, first };
}

export function validateState(raw) {
  const s = raw;
  if (!baseValid(s) || !SIZES[s.size] || s.w !== SIZES[s.size].w || s.h !== SIZES[s.size].h) return null;
  if (typeof s.cells !== 'string' || s.cells.length !== s.w * s.h || !/^[0-5]+$/.test(s.cells)) return null;
  if (colorOf(s, 0) === colorOf(s, 1)) return null;
  const a = sizeOfPatch(s, 0), b = sizeOfPatch(s, 1);
  if (s.status === 'playing' && isDone(s, a, b)) return null;
  // a finished game must name the right winner (games saved under the older rule ended once someone passed half)
  if (s.status === 'over' && s.winner !== (a === b ? 'draw' : a > b ? 0 : 1)) return null;
  return s;
}
