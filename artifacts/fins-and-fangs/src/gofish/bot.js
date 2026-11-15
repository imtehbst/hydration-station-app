// Go Fish bot. It plays only from what a player could know: its own hand and
// the cards you've shown you hold by asking for them. Easy ignores that, Medium
// uses it some of the time, Hard always does.
import { createGame, joinGame } from './rules.js';
import { botPlayer, pick } from '../shared/bots.js';

const USE = { easy: 0, medium: 0.5, hard: 1 };

export function chooseMove(s, seat, level, rng = Math.random) {
  const hand = s.hands[seat], kinds = [...new Set(hand)];
  if (rng() < USE[level]) {
    const sure = kinds.filter((id) => s.known[1 - seat].includes(id)); // you asked for these, so you have them
    if (sure.length) return pick(sure, rng);
    // otherwise go for the character it is closest to completing
    const most = Math.max(...kinds.map((id) => hand.filter((c) => c === id).length));
    return pick(kinds.filter((id) => hand.filter((c) => c === id).length === most), rng);
  }
  return pick(kinds, rng);
}

export function newBotGame(me, level, round = 1, opts = {}, rng = Math.random) {
  return joinGame(createGame(me, {}, round, opts, rng), botPlayer(level));
}
