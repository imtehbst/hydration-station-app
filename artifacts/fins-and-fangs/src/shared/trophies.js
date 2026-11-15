// Trophies: what they are, and a way for any game to hand one out. The strip
// under the tabs (hub.js) does the saving and the pop-up; until it is ready,
// awards wait in a queue.
export const TROPHIES = [
  { id: 'first_win', icon: '🩸', name: 'First blood', how: 'Win any game against your friend.' },
  { id: 'wins10', icon: '🦈', name: 'Apex predator', how: 'Win 10 games against your friend.' },
  { id: 'wins25', icon: '🐋', name: 'Megalodon', how: 'Win 25 games against your friend.' },
  { id: 'allround', icon: '🌊', name: 'Jack of all tides', how: 'Beat your friend at least once in seven different games.' },
  { id: 'series', icon: '🏆', name: 'Best of the best', how: 'Win a first-to-3 series in Fins & Fangs.' },
  { id: 'hardbot', icon: '🤖', name: 'Bot breaker', how: 'Beat a Hard bot in any game.' },
  { id: 'sharpshooter', icon: '🎯', name: 'Sharpshooter', how: 'Win Hooked! with at least half your casts biting.' },
  { id: 'vanish', icon: '🫧', name: 'Now you see me', how: 'Win a Vanishing game of Tic Tac Toe.' },
  { id: 'slippery', icon: '🐍', name: 'Slippery', how: 'Win Snakes & Ladders after sliding down three or more times.' },
  { id: 'frenzy', icon: '🔴', name: 'Feeding frenzy', how: 'Win a game of Shark Drop.' },
  { id: 'elephant', icon: '🧠', name: 'Never forgets', how: 'Win Memory Match by three pairs or more.' },
  { id: 'sharpteeth', icon: '🦷', name: 'Sharp teeth', how: 'Solve a Sharkle word in two guesses or fewer.' },
  { id: 'thickskin', icon: '🔥', name: 'Thick skin', how: 'Win a Sharkle game in Hard mode.' },
  { id: 'streak5', icon: '📅', name: 'On a roll', how: 'Reach a five-day streak in Sharkle Daily.' },
];
export const TROPHY = Object.fromEntries(TROPHIES.map((t) => [t.id, t]));

let giver = null;
const waiting = [];
export function award(id) { if (!TROPHY[id]) return; if (giver) giver(id); else if (!waiting.includes(id)) waiting.push(id); }
export function onAward(fn) { giver = fn; waiting.splice(0).forEach(fn); }

export function validateTrophies(raw) {
  const t = raw;
  if (!t || typeof t !== 'object' || t.v !== 1 || t.kind !== 'trophies' || !t.got || typeof t.got !== 'object') return null;
  if (!Object.entries(t.got).every(([id, at]) => TROPHY[id] && Number.isFinite(at))) return null;
  return t;
}

// The shared list of finished games against your friend.
export const HISTORY_MAX = 40;
export function validateHistory(raw) {
  const h = raw;
  if (!h || typeof h !== 'object' || h.v !== 1 || h.kind !== 'history' || !Array.isArray(h.items) || h.items.length > HISTORY_MAX) return null;
  const ok = (x) => x && typeof x.k === 'string' && typeof x.g === 'string' && Array.isArray(x.p) && x.p.length === 2 && x.p.every((u) => typeof u === 'string') && typeof x.w === 'string' && Number.isFinite(x.t);
  return h.items.every(ok) ? h : null;
}
