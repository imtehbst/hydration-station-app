// Hooked! bot. Decides only from what a player sees of the other tank:
// its own casts (bite / splash) and the sharks it has already caught.
import { SHARKS, fleetFor, cellsOf, neighbours, randomFleet } from './fleets.js';
import { createGame, joinGame, placeFleet, isLegalCast } from './rules.js';
import { botPlayer, pick } from '../shared/bots.js';

const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

// Everything a seat knows about the tank it is casting into.
function knowledge(s, seat) {
  const size = s.size;
  const k = (r, c) => r * size + c;
  const mine = s.casts.filter((x) => x.seat === seat);
  const caughtIds = new Set(mine.filter((x) => x.caught).map((x) => x.caught));
  // caught sharks are shown on the board, so their squares are known
  const caught = (s.fleets[1 - seat] || []).filter((sh) => caughtIds.has(sh.id));
  const caughtCells = new Set(caught.flatMap((sh) => cellsOf(sh).map(([r, c]) => k(r, c))));
  const blocked = new Set(caughtCells);
  for (const x of mine) if (!x.hit) blocked.add(k(x.r, x.c));
  for (const sh of caught) for (const [r, c] of neighbours(sh, size)) blocked.add(k(r, c));
  const openHits = mine.filter((x) => x.hit && !caughtCells.has(k(x.r, x.c))).map((x) => [x.r, x.c]);
  const legal = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (isLegalCast(s, seat, r, c)) legal.push([r, c]);
  const remaining = fleetFor(size).filter((f) => !caughtIds.has(f.id));
  return { size, k, blocked, openHits, legal, remaining };
}

function targetSquares(kn) {
  const open = new Set(kn.openHits.map(([r, c]) => kn.k(r, c)));
  const legal = new Set(kn.legal.map(([r, c]) => kn.k(r, c)));
  const inside = (r, c) => r >= 0 && c >= 0 && r < kn.size && c < kn.size;
  const ends = [];
  const near = [];
  for (const [r, c] of kn.openHits) {
    for (const [dr, dc] of DIRS) {
      const a = r + dr, b = c + dc;
      if (!inside(a, b) || !legal.has(kn.k(a, b))) continue;
      near.push([a, b]);
      // a bite on the far side means this square extends a line of bites
      const br = r - dr, bc = c - dc;
      if (inside(br, bc) && open.has(kn.k(br, bc))) ends.push([a, b]);
    }
  }
  return ends.length ? ends : near;
}

function densityPick(kn, rng) {
  const count = new Map();
  const open = kn.openHits.map(([r, c]) => kn.k(r, c));
  const openSet = new Set(open);
  const legal = new Set(kn.legal.map(([r, c]) => kn.k(r, c)));
  for (const { len } of kn.remaining) {
    for (const dir of ['h', 'v']) {
      for (let r = 0; r < kn.size; r++) for (let c = 0; c < kn.size; c++) {
        const cells = cellsOf({ len, r, c, dir });
        if (!cells.every(([a, b]) => a < kn.size && b < kn.size && !kn.blocked.has(kn.k(a, b)))) continue;
        const keys = cells.map(([a, b]) => kn.k(a, b));
        const covers = keys.filter((x) => openSet.has(x)).length;
        if (open.length && !covers) continue; // chasing a bite: only placements through it
        const w = open.length ? covers : 1;
        for (const x of keys) if (legal.has(x)) count.set(x, (count.get(x) || 0) + w);
      }
    }
  }
  let best = [];
  let top = 0;
  for (const [x, n] of count) {
    if (n > top) { top = n; best = [x]; } else if (n === top) best.push(x);
  }
  if (!best.length) return null;
  const x = pick(best.sort((a, b) => a - b), rng);
  return [Math.floor(x / kn.size), x % kn.size];
}

export function chooseCast(s, seat, level, rng = Math.random) {
  const kn = knowledge(s, seat);
  let sq = null;
  if (level === 'hard') sq = densityPick(kn, rng);
  if (!sq && level !== 'easy' && kn.openHits.length) {
    const t = targetSquares(kn);
    if (t.length) sq = pick(t, rng);
  }
  if (!sq) sq = pick(kn.legal, rng);
  return { r: sq[0], c: sq[1] };
}

export const botFleet = (s, rng = Math.random) => randomFleet(s.size, rng);

// A fresh game against a bot: placing, the bot's sharks already hidden.
export function newBotGame(me, size, level, rng = Math.random, round = 1, salvo = false) {
  const s = joinGame(createGame(me, size, {}, round, salvo), botPlayer(level));
  return placeFleet(s, 1, randomFleet(size, rng));
}

export { SHARKS };
