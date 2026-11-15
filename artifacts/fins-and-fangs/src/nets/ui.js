// Fishing Nets — rendering.
import { renderGame, playShell, playerRow, picker, nameOf, wins } from '../shared/frame.js';
import { SIZES, countOf } from './rules.js';

const LOGO = '<h1 class="logo"><span class="f">Fishing</span> <span class="amp">Nets</span></h1>';
const FISH = ['🦈', '🐙'];

function boardHTML(view, canPlay) {
  const s = view.state, n = s.n;
  const mine = view.mySeat ?? 0;
  const cls = (owner) => (owner === null ? '' : owner === mine ? ' ome' : ' othem');
  const isLast = (k, i) => s.last && s.last[0] === k && s.last[1] === i;
  let cells = '';
  for (let R = 0; R <= 2 * n; R++) for (let C = 0; C <= 2 * n; C++) {
    const r = R >> 1, c = C >> 1;
    if (R % 2 === 0 && C % 2 === 0) cells += '<i class="nt-dot"></i>';
    else if (R % 2 === 0) { const i = r * n + c, o = s.hz[i]; cells += o === null ? `<button class="nt-line h" data-line="hz,${i}" aria-label="Line" ${canPlay ? '' : 'disabled'}><i></i></button>` : `<div class="nt-line h on${cls(o)}${isLast('hz', i) ? ' last' : ''}"><i></i></div>`; }
    else if (C % 2 === 0) { const i = r * (n + 1) + c, o = s.vt[i]; cells += o === null ? `<button class="nt-line v" data-line="vt,${i}" aria-label="Line" ${canPlay ? '' : 'disabled'}><i></i></button>` : `<div class="nt-line v on${cls(o)}${isLast('vt', i) ? ' last' : ''}"><i></i></div>`; }
    else { const o = s.boxes[r * n + c]; cells += `<div class="nt-box${cls(o)}">${o === null ? '' : FISH[o]}</div>`; }
  }
  return `<div class="nt-board" style="--n:${n}">${cells}</div>`;
}

const cfg = {
  cls: 'nt', logo: LOGO, title: '🥅 Fishing Nets', loading: 'Untangling the nets…',
  blurb: 'Take turns drawing one line between two dots. Close a square to catch the fish inside — and go again. Most fish wins!',
  options: (view) => picker('size', SIZES, view, 'Board size'),
  waiting: (s) => SIZES[s.n],
  play(view) {
    const s = view.state, seat = view.mySeat, over = s.status === 'over';
    const myTurn = seat !== null && !over && s.turn === seat;
    const other = seat === null ? 1 : 1 - seat;
    const turn = seat === null ? 'Watching' : over ? 'Game over' : myTurn ? 'Your turn — draw a line' : view.bot ? `${nameOf(view, other)} is thinking…` : `Waiting for ${nameOf(view, other)}…`;
    const a = countOf(s, 0), b = countOf(s, 1);
    const end = !over ? '' : s.winner === 'draw' ? `A draw — ${a} fish each!` : `${wins(view, s.winner)} ${Math.max(a, b)}–${Math.min(a, b)} ${FISH[s.winner]}`;
    const players = [0, 1].map((i) => playerRow(view, i, { icon: `<span class="nt-ico">${FISH[i]}</span>`, sub: `${countOf(s, i)} fish`, count: countOf(s, i), now: s.turn === i && !over })).join('');
    return playShell(view, { logo: LOGO, turn, myTurn, end, board: boardHTML(view, myTurn && !view.busy), players, mainCls: 'nt-main' });
  },
  bind(root, h) {
    root.querySelectorAll('[data-line]').forEach((b) => b.addEventListener('click', () => { const [k, i] = b.dataset.line.split(','); h.move([k, Number(i)]); }));
  },
};
export const render = (root, view, h) => renderGame(root, view, h, cfg);
