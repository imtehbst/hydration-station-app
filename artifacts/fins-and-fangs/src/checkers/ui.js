// Coral Checkers — rendering. Your pieces are always at the bottom of the board.
import { renderGame, playShell, playerRow, nameOf, wins } from '../shared/frame.js';
import { N, ownerOf, isKing, legalMoves, countOf } from './rules.js';

const LOGO = '<h1 class="logo"><span class="f">Coral</span> <span class="amp">Checkers</span></h1>';
const ART = ['ttt-art/shark.png', 'ttt-art/octopus.png'];
const KIND = ['Sharks', 'Octopuses'];
const piece = (v, cls = '') => `<span class="ck-piece s${ownerOf(v)}${isKing(v) ? ' king' : ''} ${cls}"><img src="${ART[ownerOf(v)]}" alt="${KIND[ownerOf(v)]}${isKing(v) ? ' king' : ''}" draggable="false">${isKing(v) ? '<b>👑</b>' : ''}</span>`;

function boardHTML(view, canPlay) {
  const s = view.state, seat = view.mySeat;
  const moves = canPlay ? legalMoves(s, seat) : [];
  const movable = new Set(moves.map(([a]) => a));
  // a piece in the middle of a multi-jump is selected for you
  const sel = s.must !== null && canPlay ? s.must : movable.has(view.ui.sel) ? view.ui.sel : null;
  const targets = new Set(moves.filter(([a]) => a === sel).map(([, b]) => b));
  const order = Array.from({ length: N * N }, (_, i) => (seat === 1 ? N * N - 1 - i : i)); // seat 1 sees the board turned round
  const last = new Set(s.last || []);
  const cells = order.map((i) => {
    const dark = (((i / N) | 0) + (i % N)) % 2 === 1, v = s.board[i];
    let cls = `ck-sq ${dark ? 'dark' : 'light'}${last.has(i) ? ' last' : ''}`;
    if (targets.has(i)) return `<button class="${cls} target" data-to="${sel},${i}" aria-label="Move here"><i></i></button>`;
    if (v && movable.has(i)) return `<button class="${cls} can${i === sel ? ' sel' : ''}" data-from="${i}" aria-label="Select piece">${piece(v)}</button>`;
    return `<div class="${cls}">${v ? piece(v) : ''}</div>`;
  }).join('');
  return `<div class="ck-board">${cells}</div>`;
}

const cfg = {
  cls: 'ck', logo: LOGO, title: '🪸 Coral Checkers', loading: 'Setting up the board…',
  hero: `<div class="tt-hero"><img class="pc" src="${ART[0]}" alt="shark" draggable="false"><span>vs</span><img class="pc" src="${ART[1]}" alt="octopus" draggable="false"></div>`,
  blurb: 'Move diagonally forward and jump over the other side’s pieces to take them. If you can jump, you must. Reach the far row to become a king that moves both ways.',
  play(view) {
    const s = view.state, seat = view.mySeat, over = s.status === 'over';
    const myTurn = seat !== null && !over && s.turn === seat;
    const other = seat === null ? 1 : 1 - seat;
    const jumping = myTurn && legalMoves(s, seat).some(([a, b]) => Math.abs(((a / N) | 0) - ((b / N) | 0)) === 2);
    const turn = seat === null ? 'Watching' : over ? 'Game over' : myTurn ? (s.must !== null ? 'Keep jumping!' : jumping ? 'Your turn — you must jump' : 'Your turn — move a piece')
      : view.bot ? `${nameOf(view, other)} is thinking…` : `Waiting for ${nameOf(view, other)}…`;
    const end = !over ? '' : s.winner === 'draw' ? 'A draw — nobody could break through' : `${wins(view, s.winner)} ${s.winner === 0 ? '🦈' : '🐙'}`;
    const players = [0, 1].map((i) => playerRow(view, i, { icon: `<img class="pc mini" src="${ART[i]}" alt="" draggable="false">`, sub: `${KIND[i]} · ${countOf(s, i)} left`, count: countOf(s, i), now: s.turn === i && !over })).join('');
    return playShell(view, { logo: LOGO, turn, myTurn, end, board: boardHTML(view, myTurn && !view.busy), players, mainCls: 'ck-main' });
  },
  bind(root, h, view) {
    root.querySelectorAll('[data-from]').forEach((b) => b.addEventListener('click', () => { if (view.state.must === null) h.setUi({ sel: Number(b.dataset.from) }); }));
    root.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => h.move(b.dataset.to.split(',').map(Number))));
  },
};
export const render = (root, view, h) => renderGame(root, view, h, cfg);
