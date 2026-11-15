// Color Tide bot. Easy picks any colour, Medium grabs the most squares right
// now, Hard also looks at what that leaves for you.
import { COLORS, createGame, joinGame, canMove, recolor, sizeOfPatch } from './rules.js';
import { botPlayer, pick } from '../shared/bots.js';

const legal = (s, seat) => Array.from({ length: COLORS }, (_, c) => c).filter((c) => canMove({ ...s, turn: seat }, seat, c));
const after = (s, seat, c) => ({ ...s, cells: recolor(s, seat, c) });

export function chooseMove(s, seat, level, rng = Math.random) {
  const moves = legal(s, seat);
  if (level === 'easy') return pick(moves, rng);
  let best = -Infinity, bests = [];
  for (const c of moves) {
    const g = after(s, seat, c);
    let v = sizeOfPatch(g, seat);
    if (level === 'hard') {
      // the reply that helps the other side most
      const replies = legal(g, 1 - seat).map((d) => sizeOfPatch(after(g, 1 - seat, d), 1 - seat));
      v -= replies.length ? Math.max(...replies) : sizeOfPatch(g, 1 - seat);
    }
    if (v > best) { best = v; bests = [c]; } else if (v === best) bests.push(c);
  }
  return pick(bests, rng);
}

export function newBotGame(me, level, round = 1, opts = {}) {
  return joinGame(createGame(me, {}, round, opts), botPlayer(level));
}
