// Color Tide — rendering.
import { renderGame, playShell, playerRow, picker, nameOf, wins } from '../shared/frame.js';
import { COLORS, SIZES, patchOf, colorOf, canMove } from './rules.js';

const LOGO = '<h1 class="logo"><span class="f">Color</span> <span class="amp">Tide</span></h1>';
const NAMES = ['Red', 'Yellow', 'Green', 'White', 'Blue', 'Purple'];
const ICON = ['🦈', '🐙'];

function boardHTML(view) {
  const s = view.state;
  const patches = [patchOf(s, 0), patchOf(s, 1)];
  const mine = view.mySeat ?? 0;
  let cells = '';
  for (let i = 0; i < s.cells.length; i++) {
    const owner = patches[0].has(i) ? 0 : patches[1].has(i) ? 1 : null;
    const corner = i === (s.h - 1) * s.w ? ICON[0] : i === s.w - 1 ? ICON[1] : '';
    cells += `<i class="c${s.cells[i]}${owner === null ? '' : owner === mine ? ' ome' : ' othem'}">${corner}</i>`;
  }
  return `<div class="fl-board" style="--w:${s.w}">${cells}</div>`;
}

const cfg = {
  cls: 'fl', logo: LOGO, title: '🎨 Color Tide', loading: 'Mixing the colours…',
  blurb: 'You start in one corner, your friend in the other. Pick a colour: your patch turns that colour and swallows every touching square of it. Biggest patch wins!',
  options: (view) => picker('size', Object.fromEntries(Object.entries(SIZES).map(([k, z]) => [k, `${z.label} · ${z.w}×${z.h}`])), view, 'Board size'),
  waiting: (s) => `${SIZES[s.size].label} board`,
  play(view) {
    const s = view.state, seat = view.mySeat, over = s.status === 'over';
    const myTurn = seat !== null && !over && s.turn === seat;
    const other = seat === null ? 1 : 1 - seat;
    const turn = seat === null ? 'Watching' : over ? 'Game over' : myTurn ? 'Your turn — pick a colour' : view.bot ? `${nameOf(view, other)} is thinking…` : `Waiting for ${nameOf(view, other)}…`;
    const sizes = [patchOf(s, 0).size, patchOf(s, 1).size], total = s.w * s.h;
    const end = !over ? '' : s.winner === 'draw' ? 'A draw — the tide is even!' : `${wins(view, s.winner)} ${Math.max(...sizes)}–${Math.min(...sizes)} ${ICON[s.winner]}`;
    const players = [0, 1].map((i) => playerRow(view, i, {
      icon: `<span class="fl-swatch c${colorOf(s, i)}">${ICON[i]}</span>`, sub: `${Math.round((sizes[i] / total) * 100)}% of the sea · ${i === 0 ? 'bottom-left' : 'top-right'}`, count: sizes[i], now: s.turn === i && !over,
    })).join('');
    const pickers = Array.from({ length: COLORS }, (_, c) => {
      const ok = myTurn && !view.busy && canMove(s, seat, c);
      const taken = c === colorOf(s, 0) || c === colorOf(s, 1);
      return `<button class="fl-pick c${c}${taken ? ' taken' : ''}" data-color="${c}" aria-label="${NAMES[c]}${taken ? ' (in use)' : ''}" ${ok ? '' : 'disabled'}>${taken ? '✕' : ''}</button>`;
    }).join('');
    const board = `<div class="fl-col">${boardHTML(view)}<div class="fl-picks">${pickers}</div><p class="fl-note">${myTurn ? 'The two crossed-out colours are the ones in use.' : '&nbsp;'}</p></div>`;
    return playShell(view, { logo: LOGO, turn, myTurn, end, board, players, mainCls: 'fl-main' });
  },
  bind(root, h) {
    root.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => h.move(Number(b.dataset.color))));
  },
};
export const render = (root, view, h) => renderGame(root, view, h, cfg);
