// Fishing Nets — pure rules (dots and boxes). The sea is n x n squares. On your
// turn you draw one line between two dots. Closing a square catches the fish in
// it and gives you another turn. Most fish wins. Never mutates inputs.
import { baseGame, canJoin, finish, baseValid, isSeat, seatOf } from '../shared/base.js';

export { seatOf };
export const SIZES = { 3: 'Small · 3×3', 4: 'Medium · 4×4', 5: 'Large · 5×5' };
const sizeOf = (opts) => (SIZES[opts?.size] ? Number(opts.size) : 4);

// Lines: hz[r * n + c] is the top edge of square (r, c), for r = 0..n (so n + 1 rows of n);
//        vt[r * (n + 1) + c] is the left edge of square (r, c), for c = 0..n (n rows of n + 1).
export function createGame(creator, score = {}, round = 1, opts = {}) {
  const n = sizeOf(opts);
  return { ...baseGame(creator, score, round), n, hz: Array((n + 1) * n).fill(null), vt: Array(n * (n + 1)).fill(null), boxes: Array(n * n).fill(null), last: null };
}

export function joinGame(s, p) {
  if (!canJoin(s, p)) throw new Error('cannot join');
  return { ...s, status: 'playing', seats: [s.seats[0], p] };
}

export const isMyTurn = (s, uid) => { const seat = seatOf(s, uid); return Boolean(s && seat !== null && s.status === 'playing' && s.turn === seat); };
export const countOf = (s, seat) => s.boxes.filter((b) => b === seat).length;

// The four lines around square (r, c), as [kind, index].
export const edgesOf = (n, r, c) => [['hz', r * n + c], ['hz', (r + 1) * n + c], ['vt', r * (n + 1) + c], ['vt', r * (n + 1) + c + 1]];
// How many of a square's four lines are drawn.
export const sidesDrawn = (s, r, c) => edgesOf(s.n, r, c).filter(([k, i]) => s[k][i] !== null).length;
// The squares a line touches (one or two).
export function boxesBy(n, kind, i) {
  const out = [];
  if (kind === 'hz') { const r = Math.floor(i / n), c = i % n; if (r > 0) out.push([r - 1, c]); if (r < n) out.push([r, c]); }
  else { const r = Math.floor(i / (n + 1)), c = i % (n + 1); if (c > 0) out.push([r, c - 1]); if (c < n) out.push([r, c]); }
  return out;
}

export const canMove = (s, seat, m) => Boolean(s && s.status === 'playing' && s.turn === seat && Array.isArray(m) && (m[0] === 'hz' || m[0] === 'vt')
  && Number.isInteger(m[1]) && m[1] >= 0 && m[1] < s[m[0]].length && s[m[0]][m[1]] === null);

export function move(s, seat, m, expectedTurnNo) {
  if (expectedTurnNo !== s.turnNo || !canMove(s, seat, m)) throw new Error('illegal move');
  const [kind, i] = m;
  const next = { ...s, [kind]: s[kind].slice(), boxes: s.boxes.slice(), turnNo: s.turnNo + 1, last: [kind, i] };
  next[kind][i] = seat;
  let caught = 0;
  for (const [r, c] of boxesBy(s.n, kind, i)) {
    if (next.boxes[r * s.n + c] === null && sidesDrawn(next, r, c) === 4) { next.boxes[r * s.n + c] = seat; caught++; }
  }
  if (next.boxes.every((b) => b !== null)) {
    const a = countOf(next, 0), b = countOf(next, 1);
    return finish(next, a === b ? 'draw' : a > b ? 0 : 1);
  }
  if (!caught) next.turn = 1 - seat; // catching a fish means go again
  return next;
}

// Rematch: whoever didn't start last time starts now.
export function rematch(s) {
  if (s.status !== 'over') throw new Error('game not over');
  const first = 1 - s.first;
  return { ...createGame(s.seats[0], s.score, (s.round || 1) + 1, { size: String(s.n) }), status: 'playing', seats: s.seats, turn: first, first };
}

const lineOk = (arr, len) => Array.isArray(arr) && arr.length === len && arr.every((x) => x === null || isSeat(x));
export function validateState(raw) {
  const s = raw;
  if (!baseValid(s) || !SIZES[s.n]) return null;
  const n = s.n;
  if (!lineOk(s.hz, (n + 1) * n) || !lineOk(s.vt, n * (n + 1)) || !lineOk(s.boxes, n * n)) return null;
  // a square has an owner exactly when all four of its lines are drawn
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if ((s.boxes[r * n + c] !== null) !== (sidesDrawn(s, r, c) === 4)) return null;
  const full = s.boxes.every((b) => b !== null);
  if ((s.status === 'over') !== full) return null;
  if (full) { const a = countOf(s, 0), b = countOf(s, 1); if (s.winner !== (a === b ? 'draw' : a > b ? 0 : 1)) return null; }
  if (s.status === 'waiting' && (s.turnNo !== 0 || s.hz.some((x) => x !== null) || s.vt.some((x) => x !== null))) return null;
  return s;
}
