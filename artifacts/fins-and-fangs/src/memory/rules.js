// Memory match — pure rules. Cards lie face down; on your turn you flip two.
// A pair is yours and you go again; a miss stays face up until the other
// player starts their turn, so both of you get a look. Most pairs wins.
// Never mutates inputs.
import { CAST } from '../fnf/cast.js';

// How many pairs each size deals, and how many columns it is laid out in.
export const SIZES = { small: { pairs: 6, cols: 4 }, medium: { pairs: 10, cols: 5 }, large: { pairs: 15, cols: 6 } };
const IDS = new Set(CAST.map((c) => c.id));

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function deal(size, rng = Math.random) {
  const chars = shuffle(CAST.map((c) => c.id), rng).slice(0, SIZES[size].pairs);
  return shuffle([...chars, ...chars], rng);
}

export function createGame(creator, score = {}, round = 1, size = 'medium', rng = Math.random) {
  const deck = deal(size, rng);
  return {
    v: 1, status: 'waiting', seats: [creator, null], size, deck, owner: Array(deck.length).fill(null),
    flips: [], shown: false, seen: [], turn: 0, first: 0, turnNo: 0, winner: null, score: { ...score }, round,
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

export const pairsOf = (s, seat) => s.owner.filter((o) => o === seat).length / 2;
// The cards face up for this turn (a shown miss is cleared by the next flip).
export const openFlips = (s) => (s.shown ? [] : s.flips);
export const canFlip = (s, i) => Number.isInteger(i) && i >= 0 && i < s.deck.length && s.owner[i] === null && !openFlips(s).includes(i);

export function flip(s, seat, i, expectedTurnNo) {
  if (!s || s.status !== 'playing' || s.turn !== seat || expectedTurnNo !== s.turnNo || !canFlip(s, i)) throw new Error('illegal move');
  const flips = [...openFlips(s), i];
  const seen = s.seen.includes(i) ? s.seen : [...s.seen, i];
  const next = { ...s, flips, shown: false, seen, turnNo: s.turnNo + 1 };
  if (flips.length < 2) return next;
  const [a, b] = flips;
  if (s.deck[a] !== s.deck[b]) return { ...next, shown: true, turn: 1 - seat }; // a miss: left face up for the other player to see
  const owner = s.owner.slice();
  owner[a] = seat; owner[b] = seat;
  const got = { ...next, owner, flips: [], last: [a, b] };
  if (owner.some((o) => o === null)) return got; // a pair: same player goes again
  const mine = pairsOf(got, 0), theirs = pairsOf(got, 1);
  const winner = mine === theirs ? 'draw' : mine > theirs ? 0 : 1;
  const score = { ...s.score };
  if (winner !== 'draw') { const uid = s.seats[winner].uid; score[uid] = (score[uid] || 0) + 1; }
  return { ...got, status: 'over', winner, score };
}

// Rematch: a fresh shuffle of the same size; whoever lost goes first.
export function rematch(s, rng = Math.random) {
  if (s.status !== 'over') throw new Error('game not over');
  const first = s.winner === 'draw' ? 1 - s.first : 1 - s.winner;
  const deck = deal(s.size, rng);
  return {
    ...s, status: 'playing', deck, owner: Array(deck.length).fill(null), flips: [], shown: false, seen: [], last: null,
    turn: first, first, turnNo: 0, winner: null, round: (s.round || 1) + 1,
  };
}

const isPlayer = (p) => p && typeof p.uid === 'string' && typeof p.name === 'string';
const isSeat = (n) => n === 0 || n === 1;

export function validateState(raw) {
  const s = raw;
  if (!s || typeof s !== 'object' || s.v !== 1 || !SIZES[s.size]) return null;
  if (!['waiting', 'playing', 'over'].includes(s.status)) return null;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !isPlayer(s.seats[0])) return null;
  if (s.seats[1] !== null && !isPlayer(s.seats[1])) return null;
  if (s.status !== 'waiting' && !s.seats[1]) return null;
  if (s.seats[1] && s.seats[1].uid === s.seats[0].uid) return null;
  const n = SIZES[s.size].pairs * 2;
  if (!Array.isArray(s.deck) || s.deck.length !== n || !s.deck.every((id) => IDS.has(id))) return null;
  const count = {};
  for (const id of s.deck) count[id] = (count[id] || 0) + 1;
  if (!Object.values(count).every((k) => k === 2)) return null;
  if (!Array.isArray(s.owner) || s.owner.length !== n || !s.owner.every((o) => o === null || isSeat(o))) return null;
  // both cards of a character belong to the same player, or to nobody
  for (let i = 0; i < n; i++) if (s.owner[i] !== s.owner[s.deck.indexOf(s.deck[i])]) return null;
  const inRange = (i) => Number.isInteger(i) && i >= 0 && i < n;
  if (!Array.isArray(s.flips) || s.flips.length > 2 || !s.flips.every(inRange) || new Set(s.flips).size !== s.flips.length) return null;
  if (!s.flips.every((i) => s.owner[i] === null) || typeof s.shown !== 'boolean') return null;
  if (s.shown !== (s.flips.length === 2)) return null;
  if (s.shown && s.deck[s.flips[0]] === s.deck[s.flips[1]]) return null;
  if (!Array.isArray(s.seen) || s.seen.length > n || !s.seen.every(inRange)) return null;
  if (!isSeat(s.turn) || !isSeat(s.first) || !Number.isInteger(s.turnNo) || s.turnNo < 0) return null;
  if (!(s.winner === null || isSeat(s.winner) || s.winner === 'draw')) return null;
  const allFound = s.owner.every((o) => o !== null);
  if ((s.status === 'over') !== allFound) return null;
  if (s.status === 'over') {
    const a = pairsOf(s, 0), b = pairsOf(s, 1);
    if (s.winner !== (a === b ? 'draw' : a > b ? 0 : 1)) return null;
  } else if (s.winner !== null) return null;
  if (s.status === 'waiting' && (s.turnNo !== 0 || s.flips.length || s.owner.some((o) => o !== null))) return null;
  if (!s.score || typeof s.score !== 'object' || !Object.values(s.score).every(Number.isInteger)) return null;
  if (!Number.isInteger(s.round) || s.round < 1) return null;
  return s;
}
