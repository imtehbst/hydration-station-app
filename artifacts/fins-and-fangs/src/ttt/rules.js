// Shark Tic Tac Toe — pure game rules. Seat 0 plays the sharks, seat 1 the
// octopuses. Squares are 0..8, left to right, top to bottom. Never mutates inputs.

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
];

// The line a seat has made on this board, or null.
export function lineOf(board, seat) {
  return LINES.find((l) => l.every((i) => board[i] === seat)) || null;
}

// mode 'three' (Vanishing): each side keeps only three pieces on the board;
// placing a fourth removes that side's oldest. Games saved without a mode are classic.
export const MODES = ['classic', 'three'];
const MAX_MOVES_THREE = 60; // a vanishing game that long is called a draw

// The squares a seat has on the board, oldest first.
export function piecesOf(s, seat) {
  const mine = s.moves.filter((_, i) => (i % 2 === 0 ? s.first : 1 - s.first) === seat);
  return s.mode === 'three' ? mine.slice(-3) : mine;
}
// The piece that disappears when this seat next moves, or null.
export function fading(s, seat) {
  if (s.mode !== 'three' || s.status !== 'playing') return null;
  const mine = piecesOf(s, seat);
  return mine.length >= 3 ? mine[0] : null;
}

export function createGame(creator, score = {}, round = 1, mode = 'classic') {
  return {
    v: 1, mode, status: 'waiting', seats: [creator, null], board: Array(9).fill(null),
    turn: 0, first: 0, turnNo: 0, moves: [], winner: null, line: null, score: { ...score }, round,
  };
}

export function joinGame(s, p) {
  if (s.status !== 'waiting' || s.seats[1] || p.uid === s.seats[0].uid) throw new Error('cannot join');
  return { ...s, status: 'playing', seats: [s.seats[0], p] };
}

export function seatOf(s, uid) {
  if (!s) return null;
  if (s.seats[0]?.uid === uid) return 0;
  if (s.seats[1]?.uid === uid) return 1;
  return null;
}

export function isMyTurn(s, uid) {
  const seat = seatOf(s, uid);
  return Boolean(s && seat !== null && s.status === 'playing' && s.turn === seat);
}

// winner: 0 | 1 | 'draw' once the game is over.
export function place(s, seat, cell, expectedTurnNo) {
  if (!s || s.status !== 'playing' || s.turn !== seat || expectedTurnNo !== s.turnNo) throw new Error('illegal move');
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || s.board[cell] !== null) throw new Error('square taken');
  const board = s.board.slice();
  const gone = fading(s, seat);
  if (gone !== null) board[gone] = null;
  board[cell] = seat;
  const next = { ...s, board, turnNo: s.turnNo + 1, moves: [...s.moves, cell] };
  const line = lineOf(board, seat);
  if (line) {
    const uid = s.seats[seat].uid;
    return { ...next, status: 'over', winner: seat, line, score: { ...s.score, [uid]: (s.score[uid] || 0) + 1 } };
  }
  if (board.every((x) => x !== null) || (s.mode === 'three' && next.moves.length >= MAX_MOVES_THREE)) return { ...next, status: 'over', winner: 'draw' };
  return { ...next, turn: 1 - seat };
}

// Rematch: whoever didn't start last time starts now.
export function rematch(s) {
  if (s.status !== 'over') throw new Error('game not over');
  const first = 1 - s.first;
  return { ...s, status: 'playing', board: Array(9).fill(null), moves: [], turnNo: 0, turn: first, first, winner: null, line: null, round: (s.round || 1) + 1 };
}

const isPlayer = (p) => p && typeof p.uid === 'string' && typeof p.name === 'string';
const isSeat = (n) => n === 0 || n === 1;

// The saved board must be exactly what replaying the moves gives.
function replayOk(s) {
  if (s.status === 'waiting') return s.moves.length === 0 && s.turnNo === 0 && s.board.every((x) => x === null);
  let g = { ...s, status: 'playing', board: Array(9).fill(null), moves: [], turnNo: 0, turn: s.first, winner: null, line: null, score: {} };
  for (const cell of s.moves) {
    if (g.status !== 'playing') return false;
    try { g = place(g, g.turn, cell, g.turnNo); } catch { return false; }
  }
  if (s.turnNo !== s.moves.length || g.board.some((x, i) => x !== s.board[i])) return false;
  if (s.status === 'over') return g.status === 'over' && g.winner === s.winner && JSON.stringify(g.line) === JSON.stringify(s.line);
  return g.status === 'playing' && s.turn === g.turn && s.winner === null && s.line === null;
}

export function validateState(raw) {
  const s = raw;
  if (!s || typeof s !== 'object' || s.v !== 1) return null;
  if (s.mode !== undefined && !MODES.includes(s.mode)) return null;
  if (!['waiting', 'playing', 'over'].includes(s.status)) return null;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !isPlayer(s.seats[0])) return null;
  if (s.seats[1] !== null && !isPlayer(s.seats[1])) return null;
  if (s.status !== 'waiting' && !s.seats[1]) return null;
  if (s.seats[1] && s.seats[1].uid === s.seats[0].uid) return null;
  if (!Array.isArray(s.board) || s.board.length !== 9 || !s.board.every((x) => x === null || isSeat(x))) return null;
  if (!Array.isArray(s.moves) || !isSeat(s.turn) || !isSeat(s.first) || !Number.isInteger(s.turnNo) || s.turnNo < 0) return null;
  if (!(s.winner === null || isSeat(s.winner) || s.winner === 'draw')) return null;
  if (!(s.line === null || (Array.isArray(s.line) && s.line.length === 3))) return null;
  if (!s.score || typeof s.score !== 'object' || !Object.values(s.score).every(Number.isInteger)) return null;
  if (!Number.isInteger(s.round) || s.round < 1) return null;
  if (!replayOk(s)) return null;
  return s;
}
