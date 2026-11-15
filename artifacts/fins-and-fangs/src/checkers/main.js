// Coral Checkers — mounted by the games shell.
import * as rules from './rules.js';
import * as bot from './bot.js';
import { render } from './ui.js';
import { makeGame } from '../shared/twoplayer.js';

export const { mount } = makeGame({
  id: 'checkers', rules, bot, render,
  endToast: (s, seat) => (s.winner === 'draw' ? '🤝 A draw!' : s.winner === seat ? '👑 You win!' : 'They win this one.'),
  botDelay: (s) => (s.must !== null ? 500 : 900),
});
