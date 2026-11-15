// Fishing Nets — mounted by the games shell.
import * as rules from './rules.js';
import * as bot from './bot.js';
import { render } from './ui.js';
import { makeGame } from '../shared/twoplayer.js';

export const { mount } = makeGame({
  id: 'nets', rules, bot, render, defaults: { size: '4' },
  endToast: (s, seat) => (s.winner === 'draw' ? '🤝 A draw!' : s.winner === seat ? '🥅 You caught the most fish!' : 'They caught more fish this time.'),
  botDelay: (s) => (s.last && s.boxes.some((b) => b === 1) ? 600 : 900),
});
