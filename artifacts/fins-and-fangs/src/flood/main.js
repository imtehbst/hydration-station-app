// Color Tide — mounted by the games shell.
import * as rules from './rules.js';
import * as bot from './bot.js';
import { render } from './ui.js';
import { makeGame } from '../shared/twoplayer.js';

export const { mount } = makeGame({
  id: 'flood', rules, bot, render, defaults: { size: 'medium' },
  endToast: (s, seat) => (s.winner === 'draw' ? '🤝 A draw!' : s.winner === seat ? '🌊 Your tide took the sea!' : 'Their tide was bigger this time.'),
});
