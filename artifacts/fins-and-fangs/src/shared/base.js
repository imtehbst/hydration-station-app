// Pieces every two-player game's rules share: seats, joining, scoring a win, and the checks on a saved game.
export const isPlayer = (p) => p && typeof p.uid === 'string' && typeof p.name === 'string';
export const isSeat = (n) => n === 0 || n === 1;

export function seatOf(s, uid) {
  if (!s) return null;
  if (s.seats[0]?.uid === uid) return 0;
  if (s.seats[1]?.uid === uid) return 1;
  return null;
}

// The fields every game starts from; each game adds its own board on top.
export const baseGame = (creator, score = {}, round = 1) => ({
  v: 1, status: 'waiting', seats: [creator, null], turn: 0, first: 0, turnNo: 0, winner: null, score: { ...score }, round,
});

export function canJoin(s, p) { return s.status === 'waiting' && !s.seats[1] && p.uid !== s.seats[0].uid; }

// winner: 0 | 1 | 'draw'
export function finish(s, winner) {
  const score = { ...s.score };
  if (isSeat(winner)) { const uid = s.seats[winner].uid; score[uid] = (score[uid] || 0) + 1; }
  return { ...s, status: 'over', winner, score };
}

export function baseValid(s, statuses = ['waiting', 'playing', 'over']) {
  if (!s || typeof s !== 'object' || s.v !== 1 || !statuses.includes(s.status)) return false;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !isPlayer(s.seats[0])) return false;
  if (s.seats[1] !== null && !isPlayer(s.seats[1])) return false;
  if (s.status !== 'waiting' && !s.seats[1]) return false;
  if (s.seats[1] && s.seats[1].uid === s.seats[0].uid) return false;
  if (!isSeat(s.turn) || !isSeat(s.first) || !Number.isInteger(s.turnNo) || s.turnNo < 0) return false;
  if (!(s.winner === null || isSeat(s.winner) || s.winner === 'draw')) return false;
  if ((s.status === 'over') !== (s.winner !== null)) return false;
  if (!s.score || typeof s.score !== 'object' || !Object.values(s.score).every(Number.isInteger)) return false;
  return Number.isInteger(s.round) && s.round >= 1;
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
