// Shark Drop — pure rules (four in a row). Seat 0 plays the sharks, seat 1 the
// octopuses. Pieces fall down one of 7 columns in a 6-row tank; four in a line
// wins. Only the list of columns played is saved; the board is rebuilt from it.
// Never mutates inputs.

export const COLS = 7;
export const ROWS = 6;

const seatAt = (s, i) => (i % 2 === 0 ? s.first : 1 - s.first);

// The board as 42 squares, row 0 at the top: null | 0 | 1.
export function boardOf(s) {
  const b = Array(COLS * ROWS).fill(null);
  const h = Array(COLS).fill(0);
  s.moves.forEach((c, i) => { b[(ROWS - 1 - h[c]) * COLS + c] = seatAt(s, i); h[c]++; });
  return b;
}

export const heightOf = (s, col) => s.moves.filter((c) => c === col).length;
export const canDrop = (s, col) => Number.isInteger(col) && col >= 0 && col < COLS && heightOf(s, col) < ROWS;

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
// Four (or more) in a line through square (r, c), as square numbers, or null.
export function lineThrough(b, r, c) {
  const seat = b[r * COLS + c];
  if (seat === null) return null;
  for (const [dr, dc] of DIRS) {
    const cells = [r * COLS + c];
    for (const sign of [1, -1]) {
      let a = r + dr * sign, d = c + dc * sign;
      while (a >= 0 && a < ROWS && d >= 0 && d < COLS && b[a * COLS + d] === seat) {
        if (sign === 1) cells.push(a * COLS + d); else cells.unshift(a * COLS + d);
        a += dr * sign; d += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

export function createGame(creator, score = {}, round = 1) {
  return { v: 1, status: 'waiting', seats: [creator, null], moves: [], turn: 0, first: 0, turnNo: 0, winner: null, line: null, score: { ...score }, round };
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
export function drop(s, seat, col, expectedTurnNo) {
  if (!s || s.status !== 'playing' || s.turn !== seat || expectedTurnNo !== s.turnNo) throw new Error('illegal move');
  if (!canDrop(s, col)) throw new Error('column full');
  const row = ROWS - 1 - heightOf(s, col);
  const next = { ...s, moves: [...s.moves, col], turnNo: s.turnNo + 1 };
  const line = lineThrough(boardOf(next), row, col);
  if (line) {
    const uid = s.seats[seat].uid;
    return { ...next, status: 'over', winner: seat, line, score: { ...s.score, [uid]: (s.score[uid] || 0) + 1 } };
  }
  if (next.moves.length === COLS * ROWS) return { ...next, status: 'over', winner: 'draw' };
  return { ...next, turn: 1 - seat };
}

// Rematch: whoever didn't start last time starts now.
export function rematch(s) {
  if (s.status !== 'over') throw new Error('game not over');
  const first = 1 - s.first;
  return { ...s, status: 'playing', moves: [], turnNo: 0, turn: first, first, winner: null, line: null, round: (s.round || 1) + 1 };
}

const isPlayer = (p) => p && typeof p.uid === 'string' && typeof p.name === 'string';
const isSeat = (n) => n === 0 || n === 1;

// The saved result must be exactly what replaying the moves gives.
function replayOk(s) {
  if (s.status === 'waiting') return s.moves.length === 0 && s.turnNo === 0;
  let g = { ...s, status: 'playing', moves: [], turnNo: 0, turn: s.first, winner: null, line: null, score: {} };
  for (const col of s.moves) {
    if (g.status !== 'playing') return false;
    try { g = drop(g, g.turn, col, g.turnNo); } catch { return false; }
  }
  if (s.turnNo !== s.moves.length) return false;
  if (s.status === 'over') return g.status === 'over' && g.winner === s.winner && JSON.stringify(g.line) === JSON.stringify(s.line);
  return g.status === 'playing' && s.turn === g.turn && s.winner === null && s.line === null;
}

export function validateState(raw) {
  const s = raw;
  if (!s || typeof s !== 'object' || s.v !== 1) return null;
  if (!['waiting', 'playing', 'over'].includes(s.status)) return null;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !isPlayer(s.seats[0])) return null;
  if (s.seats[1] !== null && !isPlayer(s.seats[1])) return null;
  if (s.status !== 'waiting' && !s.seats[1]) return null;
  if (s.seats[1] && s.seats[1].uid === s.seats[0].uid) return null;
  if (!Array.isArray(s.moves) || s.moves.length > COLS * ROWS || !isSeat(s.turn) || !isSeat(s.first) || !Number.isInteger(s.turnNo) || s.turnNo < 0) return null;
  if (!(s.winner === null || isSeat(s.winner) || s.winner === 'draw')) return null;
  if (!(s.line === null || (Array.isArray(s.line) && s.line.length >= 4))) return null;
  if (!s.score || typeof s.score !== 'object' || !Object.values(s.score).every(Number.isInteger)) return null;
  if (!Number.isInteger(s.round) || s.round < 1) return null;
  if (!replayOk(s)) return null;
  return s;
}
