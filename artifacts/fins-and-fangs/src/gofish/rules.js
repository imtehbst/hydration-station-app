// Go Fish — pure rules. Nine characters, four cards of each. On your turn you
// ask the other player for a character you already hold. If they have any, they
// hand them all over and you go again. If not, you "go fish": draw a card, and
// if it's the one you asked for you go again. Four of a kind is a set, laid
// down straight away. Most sets wins (nine sets, so no ties). Never mutates inputs.
import { baseGame, canJoin, finish, baseValid, isSeat, seatOf, shuffle } from '../shared/base.js';
import { CAST } from '../fnf/cast.js';

export { seatOf };
export const KINDS = 9, COPIES = 4, HAND = 7;
const IDS = new Set(CAST.map((c) => c.id));

export function createGame(creator, score = {}, round = 1, opts = {}, rng = Math.random) {
  const chars = shuffle(CAST.map((c) => c.id), rng).slice(0, KINDS);
  const deck = shuffle(chars.flatMap((id) => Array(COPIES).fill(id)), rng);
  return {
    ...baseGame(creator, score, round), chars, hands: [deck.slice(0, HAND), deck.slice(HAND, HAND * 2)], pool: deck.slice(HAND * 2),
    sets: [[], []], known: [[], []], last: null,
  };
}

export function joinGame(s, p) {
  if (!canJoin(s, p)) throw new Error('cannot join');
  return layDown({ ...s, status: 'playing', seats: [s.seats[0], p] }, [0, 1]);
}

export const isMyTurn = (s, uid) => { const seat = seatOf(s, uid); return Boolean(s && seat !== null && s.status === 'playing' && s.turn === seat); };
export const canMove = (s, seat, m) => Boolean(s && s.status === 'playing' && s.turn === seat && typeof m === 'string' && s.hands[seat].includes(m));
const count = (hand, id) => hand.filter((c) => c === id).length;

// Any four of a kind in these players' hands become sets. `known` is what each player is known to hold
// (they asked for it, or were handed it in plain sight), which the bots may use.
function layDown(s, seats) {
  const hands = s.hands.map((h) => h.slice()), sets = s.sets.map((x) => x.slice()), known = s.known.map((k) => k.slice());
  const made = [];
  for (const seat of seats) for (const id of s.chars) {
    if (count(hands[seat], id) === COPIES) {
      hands[seat] = hands[seat].filter((c) => c !== id);
      sets[seat].push(id); made.push(id);
      for (const k of known) { const at = k.indexOf(id); if (at >= 0) k.splice(at, 1); }
    }
  }
  return { ...s, hands, sets, known, made };
}

export function move(s, seat, m, expectedTurnNo) {
  if (expectedTurnNo !== s.turnNo || !canMove(s, seat, m)) throw new Error('illegal move');
  const opp = 1 - seat;
  let hands = s.hands.map((h) => h.slice()), pool = s.pool.slice();
  const known = s.known.map((k) => k.slice());
  if (!known[seat].includes(m)) known[seat].push(m); // asking shows you hold it
  const got = count(hands[opp], m);
  let drew = false, lucky = false;
  if (got) {
    hands[opp] = hands[opp].filter((c) => c !== m);
    hands[seat].push(...Array(got).fill(m));
    const at = known[opp].indexOf(m); if (at >= 0) known[opp].splice(at, 1);
  } else if (pool.length) {
    const card = pool.shift();
    hands[seat].push(card); drew = true; lucky = card === m;
  }
  let next = layDown({ ...s, hands, pool, known, turnNo: s.turnNo + 1 }, [seat]);
  const made = next.made;
  // anyone left with no cards takes one from the pool
  hands = next.hands.map((h) => h.slice()); pool = next.pool.slice();
  for (const p of [seat, opp]) if (!hands[p].length && pool.length) hands[p].push(pool.shift());
  next = { ...next, hands, pool, last: { seat, ask: m, got, drew, lucky, set: made[0] || null } };
  delete next.made;
  if (next.sets[0].length + next.sets[1].length === KINDS) return finish(next, next.sets[0].length > next.sets[1].length ? 0 : 1);
  const again = got > 0 || lucky;
  let turn = again ? seat : opp;
  if (!next.hands[turn].length) turn = 1 - turn; // nothing to ask with and nothing to draw: the other player carries on
  return { ...next, turn };
}

// Rematch: whoever didn't start last time starts now.
export function rematch(s, rng = Math.random) {
  if (s.status !== 'over') throw new Error('game not over');
  const first = 1 - s.first;
  return layDown({ ...createGame(s.seats[0], s.score, (s.round || 1) + 1, {}, rng), status: 'playing', seats: s.seats, turn: first, first }, [0, 1]);
}

const cardsOk = (a, chars) => Array.isArray(a) && a.every((c) => chars.includes(c));
export function validateState(raw) {
  const s = raw;
  if (!baseValid(s)) return null;
  if (!Array.isArray(s.chars) || s.chars.length !== KINDS || new Set(s.chars).size !== KINDS || !s.chars.every((id) => IDS.has(id))) return null;
  if (!Array.isArray(s.hands) || s.hands.length !== 2 || !s.hands.every((h) => cardsOk(h, s.chars)) || !cardsOk(s.pool, s.chars)) return null;
  if (!Array.isArray(s.sets) || s.sets.length !== 2 || !s.sets.every((x) => cardsOk(x, s.chars))) return null;
  if (!Array.isArray(s.known) || s.known.length !== 2 || !s.known.every((k) => cardsOk(k, s.chars))) return null;
  // every character's four cards are all somewhere: in a hand, in the pool, or laid down as a set
  for (const id of s.chars) {
    const inSets = s.sets[0].filter((c) => c === id).length + s.sets[1].filter((c) => c === id).length;
    if (inSets > 1 || count(s.hands[0], id) + count(s.hands[1], id) + count(s.pool, id) + inSets * COPIES !== COPIES) return null;
  }
  const total = s.sets[0].length + s.sets[1].length;
  if ((s.status === 'over') !== (total === KINDS)) return null;
  if (s.status === 'over' && s.winner !== (s.sets[0].length > s.sets[1].length ? 0 : 1)) return null;
  if (s.status === 'playing' && !s.hands[s.turn].length) return null;
  if (s.last !== null && !(s.last && isSeat(s.last.seat) && s.chars.includes(s.last.ask))) return null;
  return s;
}
