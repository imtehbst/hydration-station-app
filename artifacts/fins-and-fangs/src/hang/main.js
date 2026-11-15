// Hangshark — mounted by the games shell.
import * as base from './rules.js';
import * as bot from './bot.js';
import { render } from './ui.js';
import { makeGame } from '../shared/twoplayer.js';

// against the bot, "play again" needs a fresh word from the bot
const rules = { ...base, rematch: bot.rematch };

export const { mount } = makeGame({
  id: 'hang', rules, bot, render,
  // on a real keyboard, typing a letter guesses it (move() ignores it unless it's your guess to make)
  onKey: (e, h) => { if (/^[a-zA-Z]$/.test(e.key)) h.move({ t: 'guess', l: e.key.toLowerCase() }); },
  endToast: (s, seat) => (s.winner === seat ? (seat === base.guesserOf(s) ? '🎉 You got the word!' : '🦈 Your word beat them!') : (seat === base.guesserOf(s) ? `🦈 The word was ${base.wordOf(s).toUpperCase()}` : 'They guessed your word!')),
});
