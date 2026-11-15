// Fins & Fangs bot. Decides only from its own question log (what a player
// sees), never from the other secret.
import { byId, questionsFor } from './cast.js';
import { createGame, joinGame, candidates, lockedQuestions, answer } from './rules.js';
import { botPlayer, pick } from '../shared/bots.js';

// Tuned by simulation (2026-11-04). The game is short and luck-heavy: the
// best play found beats a sensible player only ~55-58% of the time, so the
// levels differ mostly in how early they gamble on a guess.
//   easy:   random questions, gambles once 12 or fewer cards are left
//   medium: best question half the time, guesses at 4 or fewer
//   hard:   best question always; guesses at 2, or earlier when you're close
const GUESS_AT = { easy: 12, medium: 4 };
const SMART = { easy: 0, medium: 0.5, hard: 1 };

function hardGuesses(left, oppLeft) {
  return left <= 2 || (oppLeft <= 3 && left <= 4) || (oppLeft <= 2 && left <= 6);
}

// Questions whose yes/no split of the candidates is most even.
export function bestQuestions(cands, askable) {
  let best = [];
  let bestSide = Infinity;
  for (const q of askable) {
    const yes = cands.filter((c) => answer(q, c)).length;
    const side = Math.max(yes, cands.length - yes);
    if (side < bestSide) { bestSide = side; best = [q]; } else if (side === bestSide) best.push(q);
  }
  return best;
}

export function chooseMove(s, seat, level, rng = Math.random) {
  const cands = candidates(s, seat);
  if (s.lastChance) return { kind: 'guess', charId: pick(cands, rng) }; // one final guess to tie
  const locked = lockedQuestions(s, seat);
  const askable = questionsFor(s.v).map((q) => q.id).filter((q) => !locked.has(q));
  // the other player's board is public (the log), so the bot may race it
  const guess = level === 'hard' ? hardGuesses(cands.length, candidates(s, 1 - seat).length) : cands.length <= GUESS_AT[level];
  if (!askable.length || guess) return { kind: 'guess', charId: pick(cands, rng) };
  const smart = rng() < SMART[level];
  const q = smart ? pick(bestQuestions(cands.map(byId), askable), rng) : pick(askable, rng);
  return { kind: 'ask', q };
}

// A fresh game against a bot: playing at once, you first.
export function newBotGame(me, level, rng = Math.random) {
  return joinGame(createGame(me), botPlayer(level), rng);
}
