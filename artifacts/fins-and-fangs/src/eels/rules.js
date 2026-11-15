// Eels & Bubbles — pure game rules (an ocean take on snakes & ladders).
// Square 1 is on the seafloor, 100 is the surface. Eels bite and drag you
// down; bubble streams float you up. Never mutates inputs.

export const GOAL = 100;

// start square -> where you end up
export const BUBBLES = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
export const EELS = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 };

// Where a token lands: bounce back off the surface if the roll overshoots,
// then ride any eel or bubble stream on that square.
export function moveFrom(from, die) {
  let land = from + die;
  if (land > GOAL) land = GOAL - (land - GOAL);
  const to = BUBBLES[land] ?? EELS[land] ?? land;
  const via = BUBBLES[land] ? 'bubble' : EELS[land] ? 'eel' : null;
  return { land, to, via };
}

// mode 'pick' (Pick a die): you roll two dice and choose which one to move by.
// The two dice wait in `offer` until you choose. Games saved without a mode are classic.
export const MODES = ['classic', 'pick'];
const isDie = (d) => Number.isInteger(d) && d >= 1 && d <= 6;

export function createGame(creator, score = {}, round = 1, mode = 'classic') {
  return {
    v: 1, mode, offer: null, status: 'waiting', seats: [creator, null], pos: [0, 0],
    turn: 0, first: 0, turnNo: 0, rolls: [], winner: null, score: { ...score }, round,
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

// Pick a die: put two rolled dice on the table for this seat to choose from.
export function offerDice(s, seat, dice, expectedTurnNo) {
  if (!s || s.mode !== 'pick' || s.status !== 'playing' || s.turn !== seat || expectedTurnNo !== s.turnNo || s.offer) throw new Error('illegal move');
  if (!Array.isArray(dice) || dice.length !== 2 || !dice.every(isDie)) throw new Error('bad dice');
  return { ...s, offer: { seat, dice: dice.slice() } };
}

export function roll(s, seat, die, expectedTurnNo) {
  if (!s || s.status !== 'playing' || s.turn !== seat || expectedTurnNo !== s.turnNo) throw new Error('illegal move');
  if (!Number.isInteger(die) || die < 1 || die > 6) throw new Error('bad die');
  if (s.mode === 'pick' && !(s.offer && s.offer.seat === seat && s.offer.dice.includes(die))) throw new Error('not one of your dice');
  const from = s.pos[seat];
  const { land, to, via } = moveFrom(from, die);
  const pos = s.pos.slice();
  pos[seat] = to;
  const next = { ...s, pos, turnNo: s.turnNo + 1, rolls: [...s.rolls, { seat, die, from, land, to, via }] };
  if (s.mode === 'pick') next.offer = null;
  if (to === GOAL) {
    const uid = s.seats[seat].uid;
    next.status = 'over';
    next.winner = seat;
    next.score = { ...s.score, [uid]: (s.score[uid] || 0) + 1 };
  } else {
    next.turn = 1 - seat;
  }
  return next;
}

export function rematch(s) {
  if (s.status !== 'over') throw new Error('game not over');
  const first = 1 - s.winner; // the loser goes first
  const next = { ...s, status: 'playing', pos: [0, 0], rolls: [], turnNo: 0, turn: first, first, winner: null, round: (s.round || 1) + 1 };
  if (s.mode === 'pick') next.offer = null;
  return next;
}

const isPlayer = (p) => p && typeof p.uid === 'string' && typeof p.name === 'string';
const isSeat = (n) => n === 0 || n === 1;

function replayOk(s) {
  if (s.status === 'waiting') return s.rolls.length === 0 && s.turnNo === 0 && s.pos[0] === 0 && s.pos[1] === 0;
  const pos = [0, 0];
  let turn = s.first;
  let won = null;
  for (const x of s.rolls) {
    if (won !== null || !x || x.seat !== turn || !Number.isInteger(x.die) || x.die < 1 || x.die > 6) return false;
    const m = moveFrom(pos[turn], x.die);
    if (x.from !== pos[turn] || x.land !== m.land || x.to !== m.to || x.via !== m.via) return false;
    pos[turn] = m.to;
    if (m.to === GOAL) won = turn; else turn = 1 - turn;
  }
  if (s.turnNo !== s.rolls.length || pos[0] !== s.pos[0] || pos[1] !== s.pos[1]) return false;
  if (s.status === 'over') return won !== null && s.winner === won;
  return won === null && s.turn === turn;
}

export function validateState(raw) {
  const s = raw;
  if (!s || typeof s !== 'object' || s.v !== 1) return null;
  if (s.mode !== undefined && !MODES.includes(s.mode)) return null;
  if (s.offer !== undefined && s.offer !== null) {
    const o = s.offer;
    if (s.mode !== 'pick' || s.status !== 'playing' || !o || o.seat !== s.turn || !Array.isArray(o.dice) || o.dice.length !== 2 || !o.dice.every(isDie)) return null;
  }
  if (!['waiting', 'playing', 'over'].includes(s.status)) return null;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !isPlayer(s.seats[0])) return null;
  if (s.seats[1] !== null && !isPlayer(s.seats[1])) return null;
  if (s.status !== 'waiting' && !s.seats[1]) return null;
  if (s.seats[1] && s.seats[1].uid === s.seats[0].uid) return null;
  if (!Array.isArray(s.pos) || s.pos.length !== 2 || !s.pos.every((n) => Number.isInteger(n) && n >= 0 && n <= GOAL)) return null;
  if (!isSeat(s.turn) || !isSeat(s.first) || !Number.isInteger(s.turnNo) || s.turnNo < 0) return null;
  if (!Array.isArray(s.rolls)) return null;
  if (!(s.winner === null || isSeat(s.winner))) return null;
  if (s.status !== 'over' && s.winner !== null) return null;
  if (!s.score || typeof s.score !== 'object' || !Object.values(s.score).every(Number.isInteger)) return null;
  if (!Number.isInteger(s.round) || s.round < 1) return null;
  if (!replayOk(s)) return null;
  return s;
}

// Board geometry: square n (1..100) -> row from the bottom and column,
// snaking left-to-right then right-to-left.
export function squareXY(n) {
  const r = Math.floor((n - 1) / 10);
  const i = (n - 1) % 10;
  return { r, c: r % 2 === 0 ? i : 9 - i };
}

// A fresh game against the bot: already playing, you go first.
export const BOT = { uid: 'bot:medium', name: '🤖 Bubbles the bot' };
export function newBotGame(me, round = 1, mode = 'classic') {
  return joinGame(createGame(me, {}, round, mode), BOT);
}
