// Hooked! — shark fleets and placement rules. Pure data + functions.

export const SHARKS = Object.freeze({
  whale: { id: 'whale', name: 'Whale Shark', len: 5 },
  'great-white': { id: 'great-white', name: 'Great White', len: 4 },
  hammerhead: { id: 'hammerhead', name: 'Hammerhead', len: 3 },
  tiger: { id: 'tiger', name: 'Tiger Shark', len: 3 },
  pup: { id: 'pup', name: 'Pup', len: 2 },
});

const FLEETS = {
  8: ['great-white', 'hammerhead', 'tiger', 'pup'],
  9: ['whale', 'great-white', 'hammerhead', 'pup'],
  10: ['whale', 'great-white', 'hammerhead', 'tiger', 'pup'],
};

export const SIZES = [8, 9, 10];

export function fleetFor(size) {
  return (FLEETS[size] || []).map((id) => ({ id, len: SHARKS[id].len }));
}

export function cellsOf(sh) {
  return Array.from({ length: sh.len }, (_, i) => (sh.dir === 'h' ? [sh.r, sh.c + i] : [sh.r + i, sh.c]));
}

// Squares around a shark (8 directions), inside the tank, not on the shark.
export function neighbours(sh, size) {
  const own = new Set(cellsOf(sh).map(([r, c]) => r * size + c));
  const out = new Map();
  for (const [r, c] of cellsOf(sh)) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const a = r + dr, b = c + dc;
      if (a < 0 || b < 0 || a >= size || b >= size || own.has(a * size + b)) continue;
      out.set(a * size + b, [a, b]);
    }
  }
  return [...out.values()];
}

export function validFleet(fleet, size, { allowTouching = false } = {}) {
  if (!Array.isArray(fleet)) return false;
  const want = fleetFor(size);
  if (!want.length || fleet.length !== want.length) return false;
  const seen = new Set();
  for (let i = 0; i < want.length; i++) {
    const sh = fleet[i];
    if (!sh || sh.id !== want[i].id || sh.len !== want[i].len) return false;
    if (sh.dir !== 'h' && sh.dir !== 'v') return false;
    if (!Number.isInteger(sh.r) || !Number.isInteger(sh.c)) return false;
    for (const [r, c] of cellsOf(sh)) {
      if (r < 0 || c < 0 || r >= size || c >= size) return false;
      const k = r * size + c;
      if (seen.has(k)) return false;
      seen.add(k);
    }
  }
  // sharks may not touch, not even at the corners (older saved games may)
  if (allowTouching) return true;
  for (let i = 0; i < fleet.length; i++) {
    const near = new Set(neighbours(fleet[i], size).map(([r, c]) => r * size + c));
    for (let j = 0; j < fleet.length; j++) {
      if (i !== j && cellsOf(fleet[j]).some(([r, c]) => near.has(r * size + c))) return false;
    }
  }
  return true;
}

export function randomFleet(size, rng = Math.random) {
  for (;;) {
    const taken = new Set();
    const out = [];
    let ok = true;
    for (const { id, len } of fleetFor(size)) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const dir = rng() < 0.5 ? 'h' : 'v';
        const r = Math.floor(rng() * (dir === 'v' ? size - len + 1 : size));
        const c = Math.floor(rng() * (dir === 'h' ? size - len + 1 : size));
        const sh = { id, len, r, c, dir };
        const cells = cellsOf(sh).map(([a, b]) => a * size + b);
        if (cells.some((k) => taken.has(k))) continue;
        cells.forEach((k) => taken.add(k));
        neighbours(sh, size).forEach(([a, b]) => taken.add(a * size + b)); // keep a gap
        out.push(sh);
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return out;
  }
}

export const colName = (c) => String.fromCharCode(65 + c);
export const squareName = (r, c) => `${colName(c)}${r + 1}`;
