// Shark Tic Tac Toe — rendering. render(root, view, handlers) rebuilds the game
// area, skipping the DOM write when nothing changed (no lost taps).
import { LEVELS, LEVEL_LABEL, isBot } from '../shared/bots.js';
import { fading } from './rules.js';

const VARIANT = { classic: '⭕ Classic', three: '🫧 Vanishing' };
const variantPick = (view) => `<div class="tt-variant" role="group" aria-label="Rules">${Object.keys(VARIANT).map((v) => `<button class="${view.variant === v ? 'on' : ''}" data-variant="${v}">${VARIANT[v]}</button>`).join('')}</div>` +
  `<p class="tt-rule">${view.variant === 'three' ? 'Vanishing: you only keep three pieces. Placing a fourth pops your oldest one — no more draws.' : 'Classic: fill the board, three in a row wins.'}</p>`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const PIECES = [
  { img: 'ttt-art/shark.png', name: 'Sharks', one: 'shark', aOne: 'a shark' },
  { img: 'ttt-art/octopus.png', name: 'Octopuses', one: 'octopus', aOne: 'an octopus' },
];
const LOGO = '<h1 class="logo"><span class="f">Tic Tac</span> <span class="amp">Toe</span></h1>';

let lastHTML = '';

function nameOf(view, seat) {
  const p = view.state?.seats[seat];
  if (!p) return 'Someone';
  if (p.uid === view.me.uid) return 'You';
  return view.names[p.uid] || p.name || 'Your friend';
}

function scoreLine(view) {
  const s = view.state;
  if (!s || !s.seats[1] || isBot(s.seats[1])) return ''; // no records against bots
  const [a, b] = s.seats;
  return `<div class="score">${esc(nameOf(view, 0))} <b>${s.score[a.uid] || 0}</b> – <b>${s.score[b.uid] || 0}</b> ${esc(nameOf(view, 1))}</div>`;
}

const pieceImg = (seat, cls = '') => `<img class="pc ${cls}" src="${PIECES[seat].img}" alt="${PIECES[seat].one}" draggable="false">`;

function boardHTML(view, canPlay) {
  const s = view.state;
  const last = s.moves.at(-1);
  // Vanishing: the piece each side loses on its next move is shown fading
  const fade = [fading(s, 0), fading(s, 1)];
  const cells = s.board.map((x, i) => {
    const inLine = s.line?.includes(i) ? ' won' : '';
    const going = x !== null && fade[x] === i ? (s.turn === x ? ' fading next' : ' fading') : '';
    if (x !== null) return `<div class="cell full${inLine}${going}">${pieceImg(x, i === last ? 'new' : '')}</div>`;
    return `<button class="cell" data-cell="${i}" aria-label="Square ${i + 1}" ${canPlay ? '' : 'disabled'}>${canPlay ? pieceImg(view.mySeat, 'ghostpc') : ''}</button>`;
  }).join('');
  let strike = '';
  if (s.line) {
    const at = (i) => [(i % 3) * 33.333 + 16.667, Math.floor(i / 3) * 33.333 + 16.667];
    const [x1, y1] = at(s.line[0]);
    const [x2, y2] = at(s.line[2]);
    // run the strike a little past the outer pieces
    const dx = (x2 - x1) * 0.18, dy = (y2 - y1) * 0.18;
    strike = `<svg class="strike" viewBox="0 0 100 100" aria-hidden="true"><line x1="${x1 - dx}" y1="${y1 - dy}" x2="${x2 + dx}" y2="${y2 + dy}"/></svg>`;
  }
  return `<div class="tt-board"><div class="tt-grid">${cells}</div><div class="tt-lines"><i></i><i></i><i></i><i></i></div>${strike}</div>`;
}

function lobbyHTML(view) {
  const s = view.state;
  let body;
  if (!s) {
    body = view.bot
      ? '<p>Play a bot on your own — your game with your friend stays just as it is.</p><p><b>Pick a bot:</b></p>' +
        `<div class="levels">${LEVELS.map((l) => `<button class="big level ${view.botLevel === l ? 'picked' : ''}" data-level="${l}">🤖 ${LEVEL_LABEL[l]}</button>`).join('')}</div>` +
        variantPick(view) + '<button class="big" data-act="new">Start</button>'
      : '<p>Sharks vs octopuses. Get three in a row to win!</p>' + variantPick(view) + '<button class="big" data-act="new">Start a game</button>';
  } else if (s.seats[0].uid === view.me.uid) {
    body = '<p>Waiting for your friend to tap <b>Join</b>…</p><button class="ghost" data-act="restart">Start over</button>';
  } else {
    body = `<p><b>${esc(nameOf(view, 0))}</b> wants a game${s.mode === 'three' ? ' of <b>🫧 Vanishing</b> (three pieces each)' : ''}.</p><button class="big" data-act="join">Join game</button>`;
  }
  return `<div class="lobby"><div class="tt-hero">${pieceImg(0)}<span>vs</span>${pieceImg(1)}</div><h2>🐙 Tic Tac Toe</h2>${body}${scoreLine(view)}</div>`;
}

function playHTML(view) {
  const s = view.state;
  const seat = view.mySeat;
  const playing = seat !== null;
  const over = s.status === 'over';
  const myTurn = playing && !over && s.turn === seat;
  const dot = playing && !view.bot ? `<span class="dot ${view.peerOnline ? 'on' : ''}"></span>` : '';
  const other = playing ? 1 - seat : 1;
  const waiting = view.bot ? `${esc(nameOf(view, other))} is thinking…` : `Waiting for ${esc(nameOf(view, other))}…`;
  const turn = !playing ? 'Watching' : over ? `Game over ${dot}` : myTurn ? `Your turn — place ${PIECES[seat].aOne} ${dot}` : `${waiting} ${dot}`;
  let end = '';
  if (over) {
    const title = s.winner === 'draw' ? 'A draw — nobody got three!'
      : s.winner === seat ? `You win! ${s.winner === 0 ? '🦈' : '🐙'}`
      : `${esc(nameOf(view, s.winner))} ${nameOf(view, s.winner) === 'You' ? 'win' : 'wins'} ${s.winner === 0 ? '🦈' : '🐙'}`;
    end = `<div class="tt-end"><h2>${title}</h2>${playing ? `<button class="big" data-act="rematch">${view.bot ? 'Play again' : 'Rematch'}</button>` : ''}</div>`;
  }
  const players = [0, 1].map((i) => `<div class="pl ${s.turn === i && !over ? 'now' : ''}">${pieceImg(i, 'mini')}<span>${esc(nameOf(view, i))}<small>${PIECES[i].name}</small></span>${!view.bot && s.seats[1] && !isBot(s.seats[1]) ? `<b>${s.score[s.seats[i].uid] || 0}</b>` : ''}</div>`).join('');
  return `<div class="tt-top">${LOGO}${s.mode === 'three' ? '<span class="tt-tag" title="You only keep three pieces; your oldest pops when you place a fourth">🫧 Vanishing</span>' : ''}<div class="turn ${myTurn ? 'mine' : ''}">${turn}</div></div>${end}` +
    `<div class="tt-main">${boardHTML(view, myTurn && !view.busy)}` +
    `<aside class="tt-side"><div class="players">${players}</div>` +
    `<div class="foot">${scoreLine(view)}${playing ? '<button class="ghost" data-act="restart">New game</button>' : ''}</div></aside></div>`;
}

function screenHTML(view) {
  const banner = view.banner ? `<div class="banner">${esc(view.banner)}</div>` : '';
  if (view.screen === 'loading') return `${LOGO}<p class="msg">Chumming the water…</p>`;
  if (view.screen === 'message') {
    const btn = view.action === 'new' ? '<button class="big" data-act="new">New game</button>' : view.action === 'retry' ? '<button class="big" data-act="retry">Retry</button>' : '';
    return `${LOGO}<p class="msg">${esc(view.message)}</p><div class="lobby">${btn}</div>`;
  }
  if (view.screen === 'lobby') return banner + lobbyHTML(view);
  return banner + playHTML(view);
}

function modeBarHTML(view) {
  if (!view.hasBot) return '';
  return `<nav class="modebar">${['friend', 'bot'].map((m) => `<button class="${view.mode === m ? 'on' : ''}" data-mode="${m}">${m === 'bot' ? '🤖 Vs bot' : '👥 With friend'}</button>`).join('')}</nav>`;
}

export function render(root, view, h) {
  const html = modeBarHTML(view) + `<div class="tt tt-${view.screen}">${screenHTML(view)}</div>` +
    (view.confirm ? `<div class="overlay"><div class="endbox"><p style="font-size:18px">${esc(view.confirm.text)}</p><button class="big" data-act="yes">Yes</button><button class="ghost" data-act="no">Cancel</button></div></div>` : '') +
    (view.toast ? `<div class="toast tt-toast">${esc(view.toast)}</div>` : '');
  if (html === lastHTML && root.firstChild) return;
  lastHTML = html;
  root.innerHTML = html;
  const on = (act, fn) => root.querySelectorAll(`[data-act="${act}"]`).forEach((b) => b.addEventListener('click', fn));
  on('new', h.newGame); on('join', h.join); on('rematch', h.rematch); on('restart', h.restart);
  on('retry', h.retry); on('yes', h.confirmYes); on('no', h.confirmNo);
  root.querySelectorAll('[data-cell]').forEach((b) => b.addEventListener('click', () => h.place(Number(b.dataset.cell))));
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => h.setMode(b.dataset.mode)));
  root.querySelectorAll('[data-variant]').forEach((b) => b.addEventListener('click', () => h.setVariant(b.dataset.variant)));
  root.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => h.setBotLevel(b.dataset.level)));
}
