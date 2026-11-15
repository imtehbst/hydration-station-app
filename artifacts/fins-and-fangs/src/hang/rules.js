// Hangshark — pure rules (hangman). One player sets a secret word; the other
// guesses it a letter at a time. Each wrong letter lets the shark swim closer.
// Guess the word and the guesser scores; run out of misses and the setter does.
// The roles swap every round. Against a bot, the bot always sets the word.
// Never mutates inputs.
import { baseGame, canJoin, finish, baseValid, isSeat, seatOf } from '../shared/base.js';

export { seatOf };
export const MAX_MISSES = 7;
export const MIN_LEN = 3, MAX_LEN = 12;

// The secret is stored lightly scrambled so a glance at the data doesn't spoil it.
const SHIFT = 7;
const rot = (w, n) => [...w].map((c) => String.fromCharCode(((c.charCodeAt(0) - 97 + n + 26) % 26) + 97)).join('');
export const encode = (w) => rot(w, SHIFT).split('').reverse().join('');
export const decode = (e) => rot(e.split('').reverse().join(''), -SHIFT);
export const cleanWord = (text) => String(text || '').toLowerCase().replace(/[^a-z]/g, '');
export const wordOk = (w) => /^[a-z]+$/.test(w) && w.length >= MIN_LEN && w.length <= MAX_LEN;

export function createGame(creator, score = {}, round = 1) {
  return { ...baseGame(creator, score, round), setter: 0, w: '', guessed: [], maxMiss: MAX_MISSES };
}

// Joining starts the word-setting step: the player who made the game sets the first word.
export function joinGame(s, p) {
  if (!canJoin(s, p)) throw new Error('cannot join');
  return { ...s, status: 'setting', seats: [s.seats[0], p], turn: s.setter };
}

// A game where the word is already chosen (bot games): seat 1 set it, seat 0 guesses.
export function withWord(s, word, maxMiss = MAX_MISSES) {
  return { ...s, status: 'playing', setter: 1, turn: 0, w: encode(word), guessed: [], maxMiss };
}

export const guesserOf = (s) => 1 - s.setter;
export const wordOf = (s) => (s.w ? decode(s.w) : '');
export const missesOf = (s) => { const w = wordOf(s); return s.guessed.filter((l) => !w.includes(l)).length; };
export const solved = (s) => { const w = wordOf(s); return w.length > 0 && [...w].every((l) => s.guessed.includes(l)); };

// Setting the word is the setter's move; guessing is the guesser's.
export function isMyTurn(s, uid) {
  const seat = seatOf(s, uid);
  if (!s || seat === null) return false;
  if (s.status === 'setting') return seat === s.setter;
  return s.status === 'playing' && seat === guesserOf(s);
}

// m: { t: 'word', w } from the setter, or { t: 'guess', l } from the guesser
export function canMove(s, seat, m) {
  if (!s || !m) return false;
  if (s.status === 'setting') return seat === s.setter && m.t === 'word' && wordOk(m.w);
  return s.status === 'playing' && seat === guesserOf(s) && m.t === 'guess' && /^[a-z]$/.test(m.l) && !s.guessed.includes(m.l);
}

export function move(s, seat, m, expectedTurnNo) {
  if (expectedTurnNo !== s.turnNo || !canMove(s, seat, m)) throw new Error('illegal move');
  if (m.t === 'word') return { ...s, status: 'playing', w: encode(m.w), guessed: [], turn: guesserOf(s), turnNo: s.turnNo + 1 };
  const next = { ...s, guessed: [...s.guessed, m.l], turnNo: s.turnNo + 1 };
  if (solved(next)) return finish(next, guesserOf(s));
  if (missesOf(next) >= s.maxMiss) return finish(next, s.setter);
  return next;
}

// Next round: the roles swap. `pickWord` is given for bot games, where the bot sets every word.
export function rematch(s, pickWord = null) {
  if (s.status !== 'over') throw new Error('game not over');
  const base = { ...s, winner: null, guessed: [], w: '', round: (s.round || 1) + 1, turnNo: 0 };
  if (pickWord) return withWord(base, pickWord(), s.maxMiss);
  const setter = 1 - s.setter;
  return { ...base, status: 'setting', setter, turn: setter, first: setter };
}

export function validateState(raw) {
  const s = raw;
  if (!baseValid(s, ['waiting', 'setting', 'playing', 'over'])) return null;
  if (!isSeat(s.setter) || !Number.isInteger(s.maxMiss) || s.maxMiss < 1 || s.maxMiss > 12) return null;
  if (typeof s.w !== 'string' || !Array.isArray(s.guessed) || s.guessed.length > 26 || !s.guessed.every((l) => typeof l === 'string' && /^[a-z]$/.test(l))) return null;
  if (new Set(s.guessed).size !== s.guessed.length) return null;
  const hasWord = s.status === 'playing' || s.status === 'over';
  if (hasWord !== (s.w !== '') || (hasWord && !wordOk(wordOf(s)))) return null;
  if (!hasWord && s.guessed.length) return null;
  if (hasWord) {
    const won = solved(s), lost = missesOf(s) >= s.maxMiss;
    if ((s.status === 'over') !== (won || lost)) return null;
    if (s.status === 'over' && s.winner !== (won ? guesserOf(s) : s.setter)) return null;
  }
  return s;
}
