// Hooked! — pure game rules. Never mutates inputs.
import { SHARKS, SIZES, fleetFor, cellsOf, validFleet, neighbours } from './fleets.js';

// `round` keeps counting across new games so a stale write from the last
// game can never match this one.
// Salvo (optional): each turn you get one cast per shark you still have, and
// a bite no longer earns an extra cast. `shots` is how many casts the player
// whose turn it is still has. Games saved without `salvo` play the classic way.
export function createGame(creator, size, score = {}, round = 1, salvo = false) {
  return {
    v: 1, salvo: Boolean(salvo), shots: null, status: 'waiting', size, seats: [creator, null], fleets: [null, null],
    turn: 0, first: 0, turnNo: 0, casts: [], winner: null, score: { ...score }, round,
  };
}

export function joinGame(s, p) {
  if (s.status !== 'waiting' || s.seats[1] || p.uid === s.seats[0].uid) throw new Error('cannot join');
  return { ...s, status: 'placing', seats: [s.seats[0], p] };
}

export function seatOf(s, uid) {
  if (!s) return null;
  if (s.seats[0]?.uid === uid) return 0;
  if (s.seats[1]?.uid === uid) return 1;
  return null;
}

export function isMyTurn(s, uid) {
  const seat = seatOf(s, uid);
  if (!s || seat === null) return false;
  if (s.status === 'placing') return s.fleets[seat] === null;
  return s.status === 'playing' && s.turn === seat;
}

export function placeFleet(s, seat, fleet) {
  if (s.status !== 'placing' || s.fleets[seat] !== null || !validFleet(fleet, s.size)) throw new Error('bad fleet');
  const fleets = s.fleets.slice();
  fleets[seat] = fleet.map((sh) => ({ id: sh.id, len: sh.len, r: sh.r, c: sh.c, dir: sh.dir }));
  const next = { ...s, fleets };
  if (fleets[0] && fleets[1]) {
    next.status = 'playing'; next.turn = s.first;
    if (s.salvo) next.shots = fleets[s.first].length;
  }
  return next;
}

const key = (r, c) => `${r},${c}`;

// Which shark (if any) sits at r,c in a fleet.
function sharkAt(fleet, r, c) {
  return fleet.find((sh) => cellsOf(sh).some(([a, b]) => a === r && b === c)) || null;
}

function hitsBy(casts, seat) {
  return new Set(casts.filter((x) => x.seat === seat && x.hit).map((x) => key(x.r, x.c)));
}

// Squares known empty because they touch a shark that `seat` has caught.
function autoEmpty(casts, fleet, seat, size) {
  const caught = new Set(casts.filter((x) => x.seat === seat && x.caught).map((x) => x.caught));
  const occupied = new Set((fleet || []).flatMap((sh) => cellsOf(sh).map(([r, c]) => key(r, c))));
  const out = new Map();
  for (const sh of fleet || []) if (caught.has(sh.id)) {
    for (const [r, c] of neighbours(sh, size)) if (!occupied.has(key(r, c))) out.set(key(r, c), { r, c });
  }
  return out;
}

export function isLegalCast(s, seat, r, c) {
  if (!s || s.status !== 'playing' || s.turn !== seat) return false;
  if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= s.size || c >= s.size) return false;
  if (autoEmpty(s.casts, s.fleets[1 - seat], seat, s.size).has(key(r, c))) return false;
  return !s.casts.some((x) => x.seat === seat && x.r === r && x.c === c);
}

function caughtAfter(fleet, hits, sh) {
  return sh && cellsOf(sh).every(([a, b]) => hits.has(key(a, b))) ? sh.id : null;
}

export function castAt(s, seat, r, c, expectedTurnNo) {
  if (expectedTurnNo !== s.turnNo || !isLegalCast(s, seat, r, c)) throw new Error('illegal move');
  const target = s.fleets[1 - seat];
  const sh = sharkAt(target, r, c);
  const hits = hitsBy(s.casts, seat);
  if (sh) hits.add(key(r, c));
  const caught = caughtAfter(target, hits, sh);
  const next = { ...s, turnNo: s.turnNo + 1, casts: [...s.casts, { seat, r, c, hit: Boolean(sh), caught }] };
  const allCaught = Boolean(sh) && target.every((x) => cellsOf(x).every(([a, b]) => hits.has(key(a, b))));
  if (allCaught) {
    const uid = s.seats[seat].uid;
    next.status = 'over';
    next.winner = seat;
    next.score = { ...s.score, [uid]: (s.score[uid] || 0) + 1 };
    return next;
  }
  if (s.salvo) {
    const left = (s.shots ?? 1) - 1;
    if (left > 0) next.shots = left;
    else { next.turn = 1 - seat; next.shots = sharksLeft(next, 1 - seat).length; }
    return next;
  }
  if (!sh) next.turn = 1 - seat;
  return next;
}

export function sharksLeft(s, seat) {
  const fleet = s.fleets[seat];
  if (!fleet) return fleetFor(s.size).map((x) => x.id);
  const caught = new Set(s.casts.filter((x) => x.seat === 1 - seat && x.caught).map((x) => x.caught));
  return fleet.map((x) => x.id).filter((id) => !caught.has(id));
}

// What a viewer sees of one tank: visible sharks + cast marks on it.
export function tankView(s, viewerSeat, tankSeat) {
  const fleet = s.fleets[tankSeat] || [];
  const marks = s.casts.filter((x) => x.seat === 1 - tankSeat).map(({ r, c, hit }) => ({ r, c, hit }));
  let sharks;
  if (s.status === 'over' || viewerSeat === tankSeat) sharks = fleet;
  else {
    const caught = new Set(s.casts.filter((x) => x.seat === 1 - tankSeat && x.caught).map((x) => x.caught));
    sharks = fleet.filter((sh) => caught.has(sh.id));
  }
  const castOn = new Set(marks.map((m) => key(m.r, m.c)));
  const empty = [...autoEmpty(s.casts, fleet, 1 - tankSeat, s.size).entries()].filter(([k]) => !castOn.has(k)).map(([, v]) => v);
  const caught = s.casts.filter((x) => x.seat === 1 - tankSeat && x.caught).map((x) => x.caught);
  return { size: s.size, sharks, marks, empty, caught };
}

export function rematch(s) {
  if (s.status !== 'over') throw new Error('game not over');
  const first = 1 - s.winner;
  return {
    ...s, status: 'placing', fleets: [null, null], casts: [], turnNo: 0,
    turn: first, first, winner: null, round: (s.round || 1) + 1, ...(s.salvo ? { shots: null } : {}),
  };
}

const isPlayer = (p) => p && typeof p.uid === 'string' && typeof p.name === 'string';
const isSeat = (n) => n === 0 || n === 1;

function replayOk(s) {
  if (s.status === 'waiting' || s.status === 'placing') return s.casts.length === 0 && s.turnNo === 0;
  let turn = s.first;
  const hits = [new Set(), new Set()];
  const castSquares = [new Set(), new Set()];
  let won = null;
  let shots = s.salvo ? s.fleets[s.first].length : null;
  const caughtBy = [0, 0];
  for (let i = 0; i < s.casts.length; i++) {
    const x = s.casts[i];
    if (won !== null) return false;
    if (!x || x.seat !== turn || !Number.isInteger(x.r) || !Number.isInteger(x.c)) return false;
    if (x.r < 0 || x.c < 0 || x.r >= s.size || x.c >= s.size) return false;
    if (castSquares[x.seat].has(key(x.r, x.c))) return false;
    castSquares[x.seat].add(key(x.r, x.c));
    const target = s.fleets[1 - x.seat];
    const sh = sharkAt(target, x.r, x.c);
    if (x.hit !== Boolean(sh)) return false;
    if (sh) hits[x.seat].add(key(x.r, x.c));
    if (x.caught !== caughtAfter(target, hits[x.seat], sh)) return false;
    if (x.caught) caughtBy[x.seat]++;
    if (sh && target.every((t) => cellsOf(t).every(([a, b]) => hits[x.seat].has(key(a, b))))) won = x.seat;
    else if (s.salvo) {
      shots--;
      if (shots <= 0) { turn = 1 - turn; shots = s.fleets[turn].length - caughtBy[1 - turn]; }
    } else if (!sh) turn = 1 - turn;
  }
  if (s.turnNo !== s.casts.length) return false;
  if (s.salvo && s.status === 'playing' && s.shots !== shots) return false;
  if (s.status === 'over') return won !== null && s.winner === won;
  return won === null && s.turn === turn;
}

export function validateState(raw) {
  const s = raw;
  if (!s || typeof s !== 'object' || s.v !== 1) return null;
  if (s.salvo !== undefined && typeof s.salvo !== 'boolean') return null;
  if (!(s.shots === undefined || s.shots === null || (Number.isInteger(s.shots) && s.shots >= 1 && s.shots <= 5))) return null;
  if (!['waiting', 'placing', 'playing', 'over'].includes(s.status)) return null;
  if (!SIZES.includes(s.size)) return null;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !isPlayer(s.seats[0])) return null;
  if (s.seats[1] !== null && !isPlayer(s.seats[1])) return null;
  if (s.status !== 'waiting' && !s.seats[1]) return null;
  if (s.seats[1] && s.seats[1].uid === s.seats[0].uid) return null;
  if (!Array.isArray(s.fleets) || s.fleets.length !== 2) return null;
  if (!s.fleets.every((f) => f === null || validFleet(f, s.size, { allowTouching: true }))) return null;
  if ((s.status === 'playing' || s.status === 'over') && !(s.fleets[0] && s.fleets[1])) return null;
  if (s.status === 'waiting' && (s.fleets[0] || s.fleets[1])) return null;
  if (s.status === 'placing' && s.fleets[0] && s.fleets[1]) return null;
  if (!isSeat(s.turn) || !isSeat(s.first) || !Number.isInteger(s.turnNo) || s.turnNo < 0) return null;
  if (!Array.isArray(s.casts)) return null;
  if (!(s.winner === null || isSeat(s.winner))) return null;
  if (s.status !== 'over' && s.winner !== null) return null;
  if (!s.score || typeof s.score !== 'object' || !Object.values(s.score).every(Number.isInteger)) return null;
  if (!Number.isInteger(s.round) || s.round < 1) return null;
  if (!s.casts.every((x) => x && (x.caught === null || SHARKS[x.caught]) && typeof x.hit === 'boolean')) return null;
  if (!replayOk(s)) return null;
  return s;
}
