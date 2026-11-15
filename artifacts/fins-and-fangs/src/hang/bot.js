// Hangshark bot: it only ever sets the word, so it never has a move to make.
// Easy picks sea words, Medium everyday words, Hard everyday words with fewer misses allowed.
import { createGame, joinGame, withWord, rematch as rulesRematch, MAX_MISSES } from './rules.js';
import { botPlayer, botLevel, pick } from '../shared/bots.js';
import { ANSWERS, COMMON } from '../wordle/words.js';

const wordFor = (level, rng = Math.random) => pick(level === 'easy' ? ANSWERS : COMMON, rng);
const missesFor = (level) => (level === 'hard' ? 5 : MAX_MISSES);

export function chooseMove() { throw new Error('the bot has no moves in Hangshark'); }

export function newBotGame(me, level, round = 1) {
  const s = joinGame(createGame(me, {}, round), botPlayer(level));
  return withWord(s, wordFor(level), missesFor(level));
}
// "Play again" against the bot: a fresh word, the bot still sets it.
export const rematch = (s) => (botLevel(s.seats[1]) ? rulesRematch(s, () => wordFor(botLevel(s.seats[1]))) : rulesRematch(s));
