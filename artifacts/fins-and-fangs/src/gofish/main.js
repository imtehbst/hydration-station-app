// Go Fish — mounted by the games shell.
import * as rules from './rules.js';
import * as bot from './bot.js';
import { render } from './ui.js';
import { makeGame } from '../shared/twoplayer.js';

export const { mount } = makeGame({
  id: 'gofish', rules, bot, render,
  endToast: (s, seat) => (s.winner === seat ? '🐟 You collected the most sets!' : 'They collected more sets this time.'),
  botDelay: () => 1500, // slow enough to read what just happened
});
