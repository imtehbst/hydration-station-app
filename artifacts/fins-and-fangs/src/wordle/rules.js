// Sharkle — pure rules for the word game. Three saved shapes:
//   solo:  your own run of words, with stats            (kind: 'solo')
//   vs:    you and a friend race on one word             (kind: 'vs')
//   daily: one word a day, everybody's board in one doc  (kind: 'daily')
// Never mutates inputs.
import { ANSWERS, COMMON, isWord } from './words.js';

export const ROWS = 6;
export const LEN = 5;

// The secret is stored lightly scrambled so a glance at the data doesn't spoil it.
const SHIFT = 11;
const rot = (w, n) => [...w].map((c) => String.fromCharCode(((c.charCodeAt(0) - 97 + n + 26) % 26) + 97)).join('');
export const encode = (w) => rot(w, SHIFT).split('').reverse().join('');
export const decode = (e) => rot(e.split('').reverse().join(''), -SHIFT);

// Where secret words come from: 'all' everyday English words, 'sea' sea words only.
// Games saved before pools existed have no pool and were sea words.
export const POOLS = { all: COMMON, sea: ANSWERS };
export const poolOf = (s) => (s?.pool === 'all' ? 'all' : 'sea');

// A word from the pool you haven't had yet. `seen` is a list of scrambled
// words already used; once the pool runs dry it starts over.
const SEEN_MAX = 1500;
export function pickWord(rng, pool, seen = []) {
  const list = POOLS[pool] || COMMON;
  const used = new Set(seen.map(decode));
  let fresh = list.filter((w) => !used.has(w));
  let kept = seen;
  if (!fresh.length) {
    const last = seen.length ? decode(seen.at(-1)) : '';
    fresh = list.filter((w) => w !== last);
    kept = seen.filter((e) => !list.includes(decode(e))); // forget this pool's words only
  }
  const word = fresh[Math.floor(rng() * fresh.length) % fresh.length];
  return { word, seen: [...kept, encode(word)].slice(-SEEN_MAX) };
}

// 'g' right spot, 'y' in the word elsewhere, 'b' not in the word. Handles repeats.
export function score(guess, answer) {
  const out = Array(LEN).fill('b');
  const left = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === answer[i]) out[i] = 'g';
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (out[i] === 'g') continue;
    if (left[guess[i]] > 0) { out[i] = 'y'; left[guess[i]]--; }
  }
  return out;
}

// Best colour seen for each letter, for the keyboard.
export function letterHints(guesses, answer) {
  const rank = { b: 1, y: 2, g: 3 };
  const hints = {};
  for (const g of guesses) {
    score(g, answer).forEach((c, i) => { if (!hints[g[i]] || rank[c] > rank[hints[g[i]]]) hints[g[i]] = c; });
  }
  return hints;
}

export const checkGuess = (w) => (w.length !== LEN ? 'short' : !isWord(w) ? 'unknown' : null);

// Hard mode: every letter you've found must be used. Returns what's wrong, or null.
const NTH = ['1st', '2nd', '3rd', '4th', '5th'];
export function hardProblem(guesses, answer, word) {
  for (const g of guesses) {
    const sc = score(g, answer);
    for (let i = 0; i < LEN; i++) if (sc[i] === 'g' && word[i] !== g[i]) return `Hard mode: ${NTH[i]} letter must be ${g[i].toUpperCase()}`;
    for (let i = 0; i < LEN; i++) if (sc[i] === 'y' && !word.includes(g[i])) return `Hard mode: guess must use ${g[i].toUpperCase()}`;
  }
  return null;
}

// A hint (once per word) reveals one letter and costs one of your six guesses.
// `hint` is the position revealed; it lives on a solo game or on a board.
export const hasHint = (x) => Number.isInteger(x?.hint);
export const limitOf = (x) => ROWS - (hasHint(x) ? 1 : 0);
export const canHint = (x) => !hasHint(x) && x.guesses.length <= ROWS - 2;
// Positions not yet shown in teal by any guess.
export function hintChoices(guesses, answer) {
  return [0, 1, 2, 3, 4].filter((i) => !guesses.some((g) => g[i] === answer[i]));
}
const okHint = (x, pos) => canHint(x) && Number.isInteger(pos) && pos >= 0 && pos < LEN;

export const answerOf = (s) => (s.kind === 'daily' ? dailyWord(s.date) : decode(s.w));

// ---------- boards (vs and daily): guesses plus when you started and last guessed ----------

const freshBoard = () => ({ guesses: [], gaveUp: false, t0: null, t1: null });
const addGuess = (b, word, now) => ({ ...b, guesses: [...b.guesses, word], t0: b.t0 ?? now, t1: now });
export const solvedIn = (b, answer) => (b.guesses.at(-1) === answer ? b.guesses.length : null);
export const boardDone = (b, answer) => b.gaveUp || solvedIn(b, answer) !== null || b.guesses.length >= limitOf(b);
// What a solved board costs: its guesses, plus one if the hint was used.
export const costOf = (b, answer) => { const n = solvedIn(b, answer); return n === null ? null : n + (hasHint(b) ? 1 : 0); };
// Milliseconds from your first guess to your last, or null if unknown.
export const timeOf = (b) => (Number.isFinite(b.t0) && Number.isFinite(b.t1) ? Math.max(0, b.t1 - b.t0) : null);
export const fmtTime = (ms) => {
  if (ms === null) return '';
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

// ---------- solo ----------

export const emptyStats = () => ({ played: 0, wins: 0, streak: 0, best: 0, dist: Array(ROWS).fill(0) });

export function newSolo(prev, rng = Math.random, pool = 'all', hard = false) {
  const stats = prev?.stats ? { ...prev.stats, dist: prev.stats.dist.slice() } : emptyStats();
  const before = prev ? [...(prev.seen || []).filter((e) => e !== prev.w), prev.w] : [];
  const { word, seen } = pickWord(rng, pool, before);
  return { v: 1, kind: 'solo', pool, hard, w: encode(word), seen, guesses: [], status: 'playing', won: false, round: (prev?.round || 0) + 1, stats };
}

function finishStats(stats, won, n) {
  const s = { ...stats, dist: stats.dist.slice(), played: stats.played + 1 };
  if (won) { s.wins++; s.streak++; s.best = Math.max(s.best, s.streak); s.dist[n - 1]++; } else s.streak = 0;
  return s;
}

export function soloGuess(s, word) {
  if (s.status !== 'playing' || checkGuess(word) || (s.hard && hardProblem(s.guesses, decode(s.w), word))) throw new Error('bad guess');
  const guesses = [...s.guesses, word];
  const won = word === decode(s.w);
  if (won || guesses.length >= limitOf(s)) return { ...s, guesses, status: 'over', won, stats: finishStats(s.stats, won, guesses.length + (hasHint(s) ? 1 : 0)) };
  return { ...s, guesses };
}

export function soloHint(s, pos) {
  if (s.status !== 'playing' || !okHint(s, pos)) throw new Error('no hint');
  return { ...s, hint: pos };
}

export function soloGiveUp(s) {
  if (s.status !== 'playing') throw new Error('not playing');
  return { ...s, status: 'over', won: false, stats: finishStats(s.stats, false, 0) };
}

// ---------- vs ----------

const freshBoards = (seats) => Object.fromEntries(seats.filter(Boolean).map((p) => [p.uid, freshBoard()]));

// prev: the race this one replaces (keeps the score and the words already used)
export function createVs(creator, prev = null, rng = Math.random, pool = 'all', hard = false) {
  const before = prev ? [...(prev.seen || []).filter((e) => e !== prev.w), prev.w] : [];
  const { word, seen } = pickWord(rng, pool, before);
  return {
    v: 1, kind: 'vs', pool, hard, status: 'waiting', seats: [creator, null], w: encode(word), seen,
    boards: freshBoards([creator]), winner: null, score: { ...(prev?.score || {}) }, round: (prev?.round || 0) + 1, turnNo: 0,
  };
}

export function joinVs(s, p) {
  if (s.status !== 'waiting' || s.seats[1] || p.uid === s.seats[0].uid) throw new Error('cannot join');
  const seats = [s.seats[0], p];
  return { ...s, status: 'playing', seats, boards: freshBoards(seats), turnNo: s.turnNo + 1 };
}

export function seatOf(s, uid) {
  if (!s || s.kind !== 'vs') return null;
  if (s.seats[0]?.uid === uid) return 0;
  if (s.seats[1]?.uid === uid) return 1;
  return null;
}

// Fewer guesses wins (a miss counts as 7); the same number goes to whoever
// took less time from first guess to last. Settled as soon as nobody can change it.
export function decide(s) {
  const answer = decode(s.w);
  const res = s.seats.map((p) => {
    const b = s.boards[p.uid];
    const n = solvedIn(b, answer);
    return { done: boardDone(b, answer), cost: n === null ? ROWS + 1 : n + (hasHint(b) ? 1 : 0), used: b.guesses.length + (hasHint(b) ? 1 : 0), time: timeOf(b) };
  });
  const [a, b] = res;
  const settled = (a.done && b.done)
    || (a.done && !b.done && b.used >= a.cost) // b can't match a's guess count any more
    || (b.done && !a.done && a.used >= b.cost);
  if (!settled) return null;
  const ca = a.done ? a.cost : ROWS + 1;
  const cb = b.done ? b.cost : ROWS + 1;
  if (ca !== cb) return ca < cb ? 0 : 1;
  if (ca <= ROWS && a.time !== null && b.time !== null && a.time !== b.time) return a.time < b.time ? 0 : 1;
  return 'draw';
}

// True when the winner had the same number of guesses and won on the clock.
export function wonOnTime(s) {
  if (s.status !== 'over' || s.winner === 'draw' || s.winner === null) return false;
  const answer = decode(s.w);
  const [x, y] = s.seats.map((p) => costOf(s.boards[p.uid], answer));
  return x !== null && x === y;
}

function settle(s) {
  const winner = decide(s);
  if (winner === null) return s;
  const score = { ...s.score };
  if (winner !== 'draw') { const uid = s.seats[winner].uid; score[uid] = (score[uid] || 0) + 1; }
  return { ...s, status: 'over', winner, score };
}

export function vsGuess(s, uid, word, now = Date.now()) {
  const b = s.boards[uid];
  const answer = decode(s.w);
  if (s.status !== 'playing' || !b || boardDone(b, answer) || checkGuess(word) || (s.hard && hardProblem(b.guesses, answer, word))) throw new Error('bad guess');
  return settle({ ...s, boards: { ...s.boards, [uid]: addGuess(b, word, now) }, turnNo: s.turnNo + 1 });
}

export function vsHint(s, uid, pos) {
  const b = s.boards[uid];
  if (s.status !== 'playing' || !b || boardDone(b, decode(s.w)) || !okHint(b, pos)) throw new Error('no hint');
  return settle({ ...s, boards: { ...s.boards, [uid]: { ...b, hint: pos } }, turnNo: s.turnNo + 1 });
}

export function vsGiveUp(s, uid) {
  const b = s.boards[uid];
  if (s.status !== 'playing' || !b || boardDone(b, decode(s.w))) throw new Error('cannot give up');
  return settle({ ...s, boards: { ...s.boards, [uid]: { ...b, gaveUp: true } }, turnNo: s.turnNo + 1 });
}

export function vsRematch(s, rng = Math.random) {
  if (s.status !== 'over') throw new Error('not over');
  const { word, seen } = pickWord(rng, poolOf(s), [...(s.seen || []).filter((e) => e !== s.w), s.w]);
  return { ...s, status: 'playing', w: encode(word), seen, boards: freshBoards(s.seats), winner: null, round: s.round + 1, turnNo: s.turnNo + 1 };
}

// Your move to make: a friend's invite to join, or your board still open.
export function needsMe(s, uid) {
  if (!s || s.kind !== 'vs') return false;
  if (s.status === 'waiting') return Boolean(s.seats[0] && s.seats[0].uid !== uid && !s.seats[1]);
  const b = s.boards[uid];
  return s.status === 'playing' && Boolean(b) && !boardDone(b, decode(s.w));
}

// ---------- daily ----------

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The same everyday word for everyone on a given date.
export function dailyWord(date) {
  let h = 2166136261;
  for (const ch of `sharkle:${date}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return COMMON[(h >>> 0) % COMMON.length];
}

export const newDaily = (date) => ({ v: 1, kind: 'daily', date, boards: {} });
export const dailyBoard = (s, uid) => s.boards[uid] || freshBoard();

export function dailyGuess(s, uid, word, now = Date.now()) {
  const b = dailyBoard(s, uid);
  if (boardDone(b, dailyWord(s.date)) || checkGuess(word)) throw new Error('bad guess');
  return { ...s, boards: { ...s.boards, [uid]: addGuess(b, word, now) } };
}

export function dailyHint(s, uid, pos) {
  const b = dailyBoard(s, uid);
  if (boardDone(b, dailyWord(s.date)) || !okHint(b, pos)) throw new Error('no hint');
  return { ...s, boards: { ...s.boards, [uid]: { ...b, hint: pos } } };
}

export function dailyGiveUp(s, uid) {
  const b = dailyBoard(s, uid);
  if (boardDone(b, dailyWord(s.date))) throw new Error('cannot give up');
  return { ...s, boards: { ...s.boards, [uid]: { ...b, gaveUp: true } } };
}

// The day before a 'YYYY-MM-DD' date.
export function prevDay(date) {
  const [y, m, d] = date.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

// ---------- your own daily record (kind: 'dstats', one save per person) ----------

const HIST_MAX = 30;
export const emptyDaily = () => ({ v: 1, kind: 'dstats', played: 0, wins: 0, streak: 0, best: 0, last: '', hist: [] });

// Add one finished day (n = guesses used, 0 for a miss). Null if that day is already counted.
export function recordDaily(stats, date, n) {
  const st = stats || emptyDaily();
  if (st.last >= date) return null;
  const won = n > 0;
  const streak = won ? (st.last === prevDay(date) ? st.streak + 1 : 1) : 0;
  return {
    ...st, played: st.played + 1, wins: st.wins + (won ? 1 : 0), streak, best: Math.max(st.best, streak),
    last: date, hist: [...st.hist, { d: date, n }].slice(-HIST_MAX),
  };
}

// A streak only still counts if you played today or yesterday.
export const liveStreak = (st, today) => (st && (st.last === today || st.last === prevDay(today)) ? st.streak : 0);

// ---------- sharing ----------

const SQUARE = { g: '🟩', y: '🟨', b: '⬛' };
export function shareText({ title, guesses, answer, time = null, hard = false, hint = false }) {
  const solved = guesses.at(-1) === answer;
  const head = `${title} ${solved ? guesses.length + (hint ? 1 : 0) : 'X'}/${ROWS}${hard ? ' 🔥' : ''}${hint ? ' 💡' : ''}${solved && time !== null ? ` ⏱ ${fmtTime(time)}` : ''}`;
  return [head, ...guesses.map((g) => score(g, answer).map((c) => SQUARE[c]).join(''))].join('\n');
}

// ---------- validation ----------

const isPlayer = (p) => p && typeof p.uid === 'string' && typeof p.name === 'string';
const isEnc = (w) => typeof w === 'string' && /^[a-z]{5}$/.test(w);
const isGuesses = (g) => Array.isArray(g) && g.length <= ROWS && g.every((x) => typeof x === 'string' && /^[a-z]{5}$/.test(x));
const isInt = (n, min = 0) => Number.isInteger(n) && n >= min;
const isTime = (t) => t === null || t === undefined || Number.isFinite(t);

const isHint = (h) => h === undefined || h === null || (Number.isInteger(h) && h >= 0 && h < LEN);

function validBoard(b, answer) {
  if (!b || !isGuesses(b.guesses) || typeof b.gaveUp !== 'boolean' || !isTime(b.t0) || !isTime(b.t1) || !isHint(b.hint)) return false;
  if (b.guesses.length > limitOf(b)) return false;
  const at = b.guesses.indexOf(answer);
  return at < 0 || at === b.guesses.length - 1; // nothing after solving
}

function validStats(st) {
  return st && typeof st === 'object' && ['played', 'wins', 'streak', 'best'].every((k) => isInt(st[k]))
    && Array.isArray(st.dist) && st.dist.length === ROWS && st.dist.every((n) => isInt(n));
}

function validSolo(s) {
  if (!isEnc(s.w) || !isGuesses(s.guesses) || !['playing', 'over'].includes(s.status) || typeof s.won !== 'boolean' || !isInt(s.round, 1) || !validStats(s.stats)) return null;
  const answer = decode(s.w);
  const solvedAt = s.guesses.indexOf(answer);
  if (solvedAt >= 0 && solvedAt !== s.guesses.length - 1) return null;
  if (!isHint(s.hint) || s.guesses.length > limitOf(s)) return null;
  if (s.status === 'playing' && (solvedAt >= 0 || s.guesses.length >= limitOf(s) || s.won)) return null;
  if (s.won !== (solvedAt >= 0)) return null;
  return s;
}

function validVs(s) {
  if (!['waiting', 'playing', 'over'].includes(s.status) || !isEnc(s.w) || !isInt(s.round, 1) || !isInt(s.turnNo)) return null;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !isPlayer(s.seats[0])) return null;
  if (s.seats[1] !== null && !isPlayer(s.seats[1])) return null;
  if (s.status !== 'waiting' && !s.seats[1]) return null;
  if (s.seats[1] && s.seats[1].uid === s.seats[0].uid) return null;
  if (!s.score || typeof s.score !== 'object' || !Object.values(s.score).every((n) => isInt(n))) return null;
  if (!s.boards || typeof s.boards !== 'object') return null;
  const answer = decode(s.w);
  for (const p of s.seats.filter(Boolean)) if (!validBoard(s.boards[p.uid], answer)) return null;
  if (s.status === 'waiting') return s.winner === null ? s : null;
  const w = decide(s);
  if (s.status === 'playing') return w === null && s.winner === null ? s : null;
  return w !== null && s.winner === w ? s : null;
}

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
function validDstats(s) {
  if (!['played', 'wins', 'streak', 'best'].every((k) => isInt(s[k]))) return null;
  if (!(s.last === '' || isDate(s.last))) return null;
  if (!Array.isArray(s.hist) || s.hist.length > HIST_MAX || !s.hist.every((h) => h && isDate(h.d) && isInt(h.n) && h.n <= ROWS)) return null;
  return s;
}

function validDaily(s) {
  if (typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return null;
  if (!s.boards || typeof s.boards !== 'object' || Array.isArray(s.boards) || Object.keys(s.boards).length > 60) return null;
  const answer = dailyWord(s.date);
  return Object.values(s.boards).every((b) => validBoard(b, answer)) ? s : null;
}

export function validateState(raw) {
  const s = raw;
  if (!s || typeof s !== 'object' || s.v !== 1) return null;
  if (s.kind === 'daily') return validDaily(s);
  if (s.kind === 'dstats') return validDstats(s);
  if (s.pool !== undefined && !(s.pool in POOLS)) return null;
  if (s.hard !== undefined && typeof s.hard !== 'boolean') return null;
  if (s.seen !== undefined && !(Array.isArray(s.seen) && s.seen.length <= SEEN_MAX && s.seen.every(isEnc))) return null;
  if (s.kind === 'solo') return validSolo(s);
  if (s.kind === 'vs') return validVs(s);
  return null;
}
