// Memory match bot. It only "knows" cards that have been turned over during
// the game. Easy forgets most of them, Medium about half, Hard nearly all.
import { createGame, joinGame, openFlips } from './rules.js';
import { botPlayer, pick } from '../shared/bots.js';

const RECALL = { easy: 0.15, medium: 0.5, hard: 0.9 }; // chance it remembers a card it has seen

export function chooseFlip(s, level, rng = Math.random) {
  const open = openFlips(s);
  const free = s.owner.map((o, i) => (o === null && !open.includes(i) ? i : -1)).filter((i) => i >= 0);
  const known = s.seen.filter((i) => s.owner[i] === null && rng() < RECALL[level]);
  const unseen = free.filter((i) => !s.seen.includes(i));
  if (open.length === 1) {
    const a = open[0];
    const mate = known.find((i) => i !== a && s.deck[i] === s.deck[a]);
    if (mate !== undefined) return mate;
    return pick(unseen.length ? unseen : free, rng);
  }
  // a pair it already knows about?
  for (const i of known) {
    if (known.some((j) => j !== i && s.deck[j] === s.deck[i])) return i;
  }
  return pick(unseen.length ? unseen : free, rng);
}

// A fresh game against a bot: you go first.
export function newBotGame(me, level, round = 1, size = 'medium', rng = Math.random) {
  return joinGame(createGame(me, {}, round, size, rng), botPlayer(level));
}
