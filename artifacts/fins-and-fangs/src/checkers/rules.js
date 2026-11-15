// Coral Checkers — pure rules (American checkers / draughts). 8 x 8 board, pieces
// on the dark squares. Seat 0 starts at the bottom and moves up; seat 1 starts at
// the top and moves down. Pieces move one square diagonally forward and capture
// by jumping. A capture must be taken when there is one, and a piece that can
// jump again must keep jumping. Reaching the far row makes a king, which moves
// both ways. A player with no move loses. Never mutates inputs.
import { baseGame, canJoin, finish, baseValid, seatOf } from '../shared/base.js';

export { seatOf };
export const N = 8;
// board squares: 0 empty, 1 seat-0 piece, 2 seat-0 king, 3 seat-1 piece, 4 seat-1 king
export const ownerOf = (v) => (v === 0 ? null : v <= 2 ? 0 : 1);
export const isKing = (v) => v === 2 || v === 4;
const NO_PROGRESS_LIMIT = 80; // moves without a capture or a new king before it's called a draw

export function startBoard() {
  const b = Array(N * N).fill(0);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((r + c) % 2 === 1) { if (r < 3) b[r * N + c] = 3; else if (r > 4) b[r * N + c] = 1; }
  return b;
}

export function createGame(creator, score = {}, round = 1) {
  return { ...baseGame(creator, score, round), board: startBoard(), must: null, quiet: 0, last: null };
}

export function joinGame(s, p) {
  if (!canJoin(s, p)) throw new Error('cannot join');
  return { ...s, status: 'playing', seats: [s.seats[0], p] };
}

export const isMyTurn = (s, uid) => { const seat = seatOf(s, uid); return Boolean(s && seat !== null && s.status === 'playing' && s.turn === seat); };
export const countOf = (s, seat) => s.board.filter((v) => ownerOf(v) === seat).length;

const dirsFor = (v) => (isKing(v) ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : ownerOf(v) === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
const inside = (r, c) => r >= 0 && c >= 0 && r < N && c < N;

function movesFrom(board, i, jumpsOnly) {
  const v = board[i], seat = ownerOf(v), r = (i / N) | 0, c = i % N, steps = [], jumps = [];
  for (const [dr, dc] of dirsFor(v)) {
    const r1 = r + dr, c1 = c + dc;
    if (!inside(r1, c1)) continue;
    const mid = board[r1 * N + c1];
    if (mid === 0) { if (!jumpsOnly) steps.push([i, r1 * N + c1]); continue; }
    const r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (ownerOf(mid) !== seat && inside(r2, c2) && board[r2 * N + c2] === 0) jumps.push([i, r2 * N + c2]);
  }
  return { steps, jumps };
}

// Every move the player to move may make: [from, to]. Captures are compulsory.
export function legalMoves(s, seat = s.turn) {
  if (s.must !== null) return movesFrom(s.board, s.must, true).jumps;
  const steps = [], jumps = [];
  s.board.forEach((v, i) => { if (ownerOf(v) !== seat) return; const m = movesFrom(s.board, i, false); steps.push(...m.steps); jumps.push(...m.jumps); });
  return jumps.length ? jumps : steps;
}

export const canMove = (s, seat, m) => Boolean(s && s.status === 'playing' && s.turn === seat && Array.isArray(m)
  && legalMoves(s, seat).some(([a, b]) => a === m[0] && b === m[1]));

export function move(s, seat, m, expectedTurnNo) {
  if (expectedTurnNo !== s.turnNo || !canMove(s, seat, m)) throw new Error('illegal move');
  const [from, to] = m, board = s.board.slice();
  let v = board[from];
  board[from] = 0;
  const jumped = Math.abs(((to / N) | 0) - ((from / N) | 0)) === 2;
  if (jumped) board[(from + to) / 2] = 0;
  const row = (to / N) | 0;
  const crowned = !isKing(v) && ((seat === 0 && row === 0) || (seat === 1 && row === N - 1));
  if (crowned) v += 1;
  board[to] = v;
  let next = { ...s, board, turnNo: s.turnNo + 1, last: [from, to], must: null, quiet: jumped || crowned ? 0 : s.quiet + 1 };
  // a piece that just jumped (and wasn't crowned by it) must keep jumping if it can
  if (jumped && !crowned && movesFrom(board, to, true).jumps.length) return { ...next, must: to };
  next.turn = 1 - seat;
  if (!legalMoves(next, 1 - seat).length) return finish(next, seat); // nothing left or nowhere to go
  if (next.quiet >= NO_PROGRESS_LIMIT) return finish(next, 'draw');
  return next;
}

// Rematch: whoever didn't start last time starts now.
export function rematch(s) {
  if (s.status !== 'over') throw new Error('game not over');
  const first = 1 - s.first;
  return { ...createGame(s.seats[0], s.score, (s.round || 1) + 1), status: 'playing', seats: s.seats, turn: first, first };
}

export function validateState(raw) {
  const s = raw;
  if (!baseValid(s)) return null;
  if (!Array.isArray(s.board) || s.board.length !== N * N || !s.board.every((v, i) => Number.isInteger(v) && v >= 0 && v <= 4 && (v === 0 || (((i / N) | 0) + (i % N)) % 2 === 1))) return null;
  if (countOf(s, 0) > 12 || countOf(s, 1) > 12 || !Number.isInteger(s.quiet) || s.quiet < 0) return null;
  if (!(s.must === null || (Number.isInteger(s.must) && ownerOf(s.board[s.must]) === s.turn))) return null;
  if (s.status === 'playing' && !legalMoves(s).length) return null;
  if (s.status === 'over' && s.winner !== 'draw' && legalMoves({ ...s, must: null }, 1 - s.winner).length) return null;
  return s;
}
