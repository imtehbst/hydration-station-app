// Fins & Fangs — pure game rules. Never mutates inputs.
//
// Versions: v1 = the original 24 cards and 8 questions. v2 (every new game
// and every rematch) = the 32-card deck with mermaids, dyed hair and
// sidekicks, plus the last-chance rule: if the player who went first finds
// the other character, the other player gets one final guess to tie.
import { byId, deckFor, questionsFor } from './cast.js';

const SPECIES = new Set(['emo', 'shark', 'vampire', 'mermaid']);
const qids = (s) => questionsFor(s.v).map((q) => q.id);

export function answer(q, c) {
  if (SPECIES.has(q)) return c.species === q;
  if (q === 'boy') return c.boy;
  return Boolean(c[q]);
}

const deal = (rng, v) => {
  const deck = deckFor(v);
  return deck[Math.min(deck.length - 1, Math.floor(rng() * deck.length))].id;
};

// A series (optional): first to `to` wins, counted from the scores when the
// series began (`base`). Games saved without one are single games.
export const SERIES_TO = 3;
export function seriesInfo(s) {
  if (!s || !s.series || !s.seats[0] || !s.seats[1]) return null;
  const wins = s.seats.map((p) => Math.max(0, (s.score[p.uid] || 0) - (s.series.base[p.uid] || 0)));
  const winner = wins[0] >= s.series.to ? 0 : wins[1] >= s.series.to ? 1 : null;
  return { to: s.series.to, wins, winner };
}

export function createGame(creator, score = {}, v = 2, series = false) {
  const s = {
    v, status: 'waiting', seats: [creator, null], secrets: [null, null],
    turn: 0, turnNo: 0, log: [], winner: null, score: { ...score }, round: 1,
  };
  if (v === 2) Object.assign(s, { first: 0, lastChance: false, draw: false });
  if (series) s.series = { to: SERIES_TO, base: { ...score } };
  return s;
}

export function joinGame(s, p, rng) {
  if (s.status !== 'waiting' || s.seats[1] || p.uid === s.seats[0].uid) throw new Error('cannot join');
  const next = { ...s, status: 'playing', seats: [s.seats[0], p], secrets: [deal(rng, s.v), deal(rng, s.v)], turn: 0, turnNo: 0, log: [] };
  if (s.v === 2) Object.assign(next, { first: 0, lastChance: false, draw: false });
  return next;
}

export function seatOf(s, uid) {
  if (!s) return null;
  if (s.seats[0]?.uid === uid) return 0;
  if (s.seats[1]?.uid === uid) return 1;
  return null;
}

export function candidates(s, seat) {
  const mine = s.log.filter((e) => e.seat === seat);
  const out = new Set(mine.filter((e) => e.kind === 'guess' && !e.correct).map((e) => e.charId));
  return deckFor(s.v).filter((c) => !out.has(c.id) && mine.every((e) => e.kind !== 'ask' || answer(e.q, c) === e.answer))
    .map((c) => c.id);
}

export function lockedQuestions(s, seat) {
  const cs = candidates(s, seat).map(byId);
  return new Set(qids(s).filter((q) => cs.every((c) => answer(q, c) === answer(q, cs[0]))));
}

export function isLegal(s, seat, move) {
  if (!s || s.status !== 'playing' || s.turn !== seat || !move) return false;
  if (move.kind === 'ask') return !s.lastChance && qids(s).includes(move.q) && !lockedQuestions(s, seat).has(move.q);
  if (move.kind === 'guess') return candidates(s, seat).includes(move.charId);
  return false;
}

const scored = (s, seat) => {
  const uid = s.seats[seat].uid;
  return { ...s.score, [uid]: (s.score[uid] || 0) + 1 };
};

export function applyMove(s, seat, move, expectedTurnNo) {
  if (expectedTurnNo !== s.turnNo || !isLegal(s, seat, move)) throw new Error('illegal move');
  const target = byId(s.secrets[1 - seat]);
  const next = { ...s, turnNo: s.turnNo + 1, turn: 1 - seat };
  if (move.kind === 'ask') {
    next.log = [...s.log, { seat, kind: 'ask', q: move.q, answer: answer(move.q, target) }];
    return next;
  }
  const correct = move.charId === target.id;
  next.log = [...s.log, { seat, kind: 'guess', charId: move.charId, correct }];
  if (s.lastChance) {
    // the final guess after the first player found theirs: right ties, wrong loses
    Object.assign(next, { status: 'over', lastChance: false, turn: seat });
    if (correct) Object.assign(next, { draw: true, winner: null });
    else Object.assign(next, { winner: s.first, score: scored(s, s.first) });
    return next;
  }
  if (!correct) return next;
  if (s.v === 2 && seat === s.first) return { ...next, lastChance: true }; // turn already passed to the other player
  return { ...next, status: 'over', winner: seat, turn: seat, score: scored(s, seat) };
}

export function rematch(s, rng) {
  if (s.status !== 'over') throw new Error('game not over');
  // loser goes first; after a draw, whoever went second this round
  const first = s.draw ? 1 - s.first : 1 - s.winner;
  // a finished series starts over from the scores as they stand now
  const series = s.series && seriesInfo(s)?.winner !== null ? { series: { to: s.series.to, base: { ...s.score } } } : {};
  return {
    ...s, ...series, v: 2, status: 'playing', secrets: [deal(rng, 2), deal(rng, 2)], log: [],
    turnNo: 0, turn: first, first, winner: null, lastChance: false, draw: false, round: (s.round || 1) + 1,
  };
}

// ---------- board shuffle: per player, per round, stable across reloads ----------

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function boardOrder(s, uid) {
  const seed = [uid, s.round || 1, ...s.secrets, ...s.seats.map((p) => p?.uid)].join('|');
  const rnd = mulberry32(hash(seed));
  const ids = deckFor(s.v).map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

// ---------- validation: replay the log against the secrets ----------

function entryTrue(s, e) {
  const target = byId(s.secrets[1 - e.seat]);
  if (e.kind === 'ask') return e.answer === answer(e.q, target);
  return e.correct === (e.charId === target.id);
}

// v1: seats alternate, only the final entry may be a winning guess.
function consistentV1(s) {
  if (s.status === 'waiting') return s.log.length === 0;
  for (let i = 0; i < s.log.length; i++) {
    const e = s.log[i];
    if (i > 0 && s.log[i - 1].seat === e.seat) return false;
    if (!entryTrue(s, e)) return false;
    if (e.kind === 'guess' && e.correct && i !== s.log.length - 1) return false;
  }
  const last = s.log.at(-1);
  const won = Boolean(last?.kind === 'guess' && last.correct);
  if (s.status === 'over') return won && s.winner === last.seat;
  if (won) return false;
  if (last && s.turn !== 1 - last.seat) return false;
  return s.turnNo === s.log.length;
}

// v2: as v1, plus the first mover starts, and a right guess by the first
// mover is followed by at most one final guess from the other player.
function consistentV2(s) {
  if (s.status === 'waiting') return s.log.length === 0 && !s.lastChance && !s.draw;
  let found = -1; // where the first mover found the other character
  for (let i = 0; i < s.log.length; i++) {
    const e = s.log[i];
    if (i === 0 && e.seat !== s.first) return false;
    if (i > 0 && s.log[i - 1].seat === e.seat) return false;
    if (!entryTrue(s, e)) return false;
    if (found >= 0) {
      if (i !== found + 1 || e.kind !== 'guess' || i !== s.log.length - 1) return false;
    } else if (e.kind === 'guess' && e.correct) {
      if (e.seat === s.first) found = i;
      else if (i !== s.log.length - 1) return false;
    }
  }
  const last = s.log.at(-1);
  if (s.turnNo !== s.log.length) return false;
  if (found >= 0 && found === s.log.length - 1) {
    return s.status === 'playing' && s.lastChance && !s.draw && s.winner === null && s.turn === 1 - s.first;
  }
  if (found >= 0) {
    if (s.status !== 'over' || s.lastChance) return false;
    return last.correct ? (s.draw && s.winner === null) : (!s.draw && s.winner === s.first);
  }
  const won = Boolean(last?.kind === 'guess' && last.correct);
  if (won) return s.status === 'over' && s.winner === last.seat && !s.draw && !s.lastChance;
  if (s.status !== 'playing' || s.lastChance || s.draw) return false;
  return s.turn === (last ? 1 - last.seat : s.first);
}

const isPlayer = (p) => p && typeof p.uid === 'string' && typeof p.name === 'string';
const isSeat = (n) => n === 0 || n === 1;

function validEntry(s, e) {
  if (!e || !isSeat(e.seat)) return false;
  if (e.kind === 'ask') return qids(s).includes(e.q) && typeof e.answer === 'boolean';
  if (e.kind === 'guess') return deckFor(s.v).some((c) => c.id === e.charId) && typeof e.correct === 'boolean';
  return false;
}

export function validateState(raw) {
  const s = raw;
  if (!s || typeof s !== 'object' || (s.v !== 1 && s.v !== 2)) return null;
  if (!['waiting', 'playing', 'over'].includes(s.status)) return null;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !isPlayer(s.seats[0])) return null;
  if (s.seats[1] !== null && !isPlayer(s.seats[1])) return null;
  if (s.seats[1] && s.seats[1].uid === s.seats[0].uid) return null;
  if (!Array.isArray(s.secrets) || s.secrets.length !== 2) return null;
  const deck = new Set(deckFor(s.v).map((c) => c.id));
  if (!s.secrets.every((id) => id === null || deck.has(id))) return null;
  if (s.status !== 'waiting' && (!s.seats[1] || !s.secrets.every(Boolean))) return null;
  if (!isSeat(s.turn) || !Number.isInteger(s.turnNo) || s.turnNo < 0) return null;
  if (!Array.isArray(s.log) || !s.log.every((e) => validEntry(s, e))) return null;
  if (!(s.winner === null || isSeat(s.winner))) return null;
  if (!s.score || typeof s.score !== 'object' || !Object.values(s.score).every(Number.isInteger)) return null;
  if (s.round !== undefined && (!Number.isInteger(s.round) || s.round < 1)) return null;
  if (s.series !== undefined && s.series !== null) {
    const x = s.series;
    if (typeof x !== 'object' || !Number.isInteger(x.to) || x.to < 2 || x.to > 9 || !x.base || typeof x.base !== 'object' || !Object.values(x.base).every(Number.isInteger)) return null;
  }
  if (s.v === 2) {
    if (!isSeat(s.first) || typeof s.lastChance !== 'boolean' || typeof s.draw !== 'boolean') return null;
    if (s.status === 'over' && s.winner === null && !s.draw) return null;
    if (!consistentV2(s)) return null;
  } else {
    if (s.status === 'over' && s.winner === null) return null;
    if (!consistentV1(s)) return null;
  }
  return s;
}

// Whose board to draw. viewSeat null = your own (or everything, for a
// spectator). Built only from the log, so viewing a board reveals no secret.
export function boardView(s, mySeat, viewSeat) {
  const seat = viewSeat ?? mySeat;
  const up = seat === null ? deckFor(s.v).map((c) => c.id) : candidates(s, seat);
  const interactive = mySeat !== null && seat === mySeat && s.status === 'playing';
  return { seat, up, interactive };
}
