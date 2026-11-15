// Memory match — rendering. render(root, view, handlers) rebuilds the game
// area, skipping the DOM write when nothing changed (no lost taps).
import { LEVELS, LEVEL_LABEL, isBot } from '../shared/bots.js';
import { byId } from '../fnf/cast.js';
import { faceHTML, cardBackHTML } from '../fnf/art.js';
import { SIZES, pairsOf, openFlips, canFlip } from './rules.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOGO = '<h1 class="logo"><span class="f">Memory</span> <span class="amp">Match</span></h1>';
const SIZE_LABEL = { small: 'Small · 12 cards', medium: 'Medium · 20 cards', large: 'Large · 30 cards' };

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

const sizePick = (view) => `<div class="mm-sizes" role="group" aria-label="Board size">${Object.keys(SIZES).map((z) => `<button class="${view.size === z ? 'on' : ''}" data-size="${z}">${SIZE_LABEL[z]}</button>`).join('')}</div>`;

function boardHTML(view, canPlay) {
  const s = view.state;
  const up = new Set(s.flips); // includes a shown miss
  const last = new Set(s.last || []);
  const cards = s.deck.map((id, i) => {
    const owner = s.owner[i];
    if (owner === null && !up.has(i)) {
      return `<button class="mcard down" data-card="${i}" aria-label="Card ${i + 1}" ${canPlay && canFlip(s, i) ? '' : 'disabled'}>${cardBackHTML()}</button>`;
    }
    const c = byId(id);
    const cls = owner !== null ? `got o${owner === view.mySeat || (view.mySeat === null && owner === 0) ? 'me' : 'them'}${last.has(i) ? ' new' : ''}` : `up${s.shown ? ' miss' : ''}`;
    return `<div class="mcard ${cls}">${faceHTML(c)}<span class="nm">${esc(c.name)}</span></div>`;
  }).join('');
  return `<div class="mm-board" style="--cols:${SIZES[s.size].cols}">${cards}</div>`;
}

function lobbyHTML(view) {
  const s = view.state;
  let body;
  if (!s) {
    body = (view.bot
      ? '<p>Play a bot on your own — your game with your friend stays just as it is.</p><p><b>Pick a bot:</b></p>' +
        `<div class="levels">${LEVELS.map((l) => `<button class="big level ${view.botLevel === l ? 'picked' : ''}" data-level="${l}">🤖 ${LEVEL_LABEL[l]}</button>`).join('')}</div>`
      : '<p>Flip two cards. Find a pair and go again — most pairs wins!</p>') +
      `${sizePick(view)}<button class="big" data-act="new">${view.bot ? 'Start' : 'Start a game'}</button>`;
  } else if (s.seats[0].uid === view.me.uid) {
    body = `<p>Waiting for your friend to tap <b>Join</b>… (${esc(SIZE_LABEL[s.size])})</p><button class="ghost" data-act="restart">Start over</button>`;
  } else {
    body = `<p><b>${esc(nameOf(view, 0))}</b> wants a game (${esc(SIZE_LABEL[s.size])}).</p><button class="big" data-act="join">Join game</button>`;
  }
  return `<div class="lobby"><h2>🧠 Memory Match</h2>${body}${scoreLine(view)}</div>`;
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
  const mineNow = myTurn ? (openFlips(s).length ? 'Your turn — flip a second card' : s.shown ? 'Your turn — have a look, then flip' : 'Your turn — flip a card') : '';
  const turn = !playing ? 'Watching' : over ? `Game over ${dot}` : myTurn ? `${mineNow} ${dot}` : `${waiting} ${dot}`;
  let end = '';
  if (over) {
    const a = pairsOf(s, 0), b = pairsOf(s, 1);
    const title = s.winner === 'draw' ? `A draw — ${a} pairs each!`
      : s.winner === seat ? `You win ${Math.max(a, b)}–${Math.min(a, b)}! 🧠`
      : `${esc(nameOf(view, s.winner))} ${nameOf(view, s.winner) === 'You' ? 'win' : 'wins'} ${Math.max(a, b)}–${Math.min(a, b)}`;
    end = `<div class="tt-end"><h2>${title}</h2>${playing ? `<button class="big" data-act="rematch">${view.bot ? 'Play again' : 'Rematch'}</button>` : ''}</div>`;
  }
  const me = playing ? seat : 0;
  const players = [0, 1].map((i) => `<div class="pl ${s.turn === i && !over ? 'now' : ''}"><span class="mm-chip ${i === me ? 'ome' : 'othem'}"></span><span>${esc(nameOf(view, i))}<small>${pairsOf(s, i)} pair${pairsOf(s, i) === 1 ? '' : 's'}</small></span><b>${pairsOf(s, i)}</b></div>`).join('');
  return `<div class="tt-top">${LOGO}<div class="turn ${myTurn ? 'mine' : ''}">${turn}</div></div>${end}` +
    `<div class="tt-main mm-main">${boardHTML(view, myTurn && !view.busy)}` +
    `<aside class="tt-side"><div class="players">${players}</div>` +
    `<div class="foot">${scoreLine(view)}${playing ? '<button class="ghost" data-act="restart">New game</button>' : ''}</div></aside></div>`;
}

function screenHTML(view) {
  const banner = view.banner ? `<div class="banner">${esc(view.banner)}</div>` : '';
  if (view.screen === 'loading') return `${LOGO}<p class="msg">Shuffling the cards…</p>`;
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
  const html = modeBarHTML(view) + `<div class="tt mm tt-${view.screen}">${screenHTML(view)}</div>` +
    (view.confirm ? `<div class="overlay"><div class="endbox"><p style="font-size:18px">${esc(view.confirm.text)}</p><button class="big" data-act="yes">Yes</button><button class="ghost" data-act="no">Cancel</button></div></div>` : '') +
    (view.toast ? `<div class="toast tt-toast">${esc(view.toast)}</div>` : '');
  if (html === lastHTML && root.firstChild) return;
  lastHTML = html;
  root.innerHTML = html;
  const on = (act, fn) => root.querySelectorAll(`[data-act="${act}"]`).forEach((b) => b.addEventListener('click', fn));
  on('new', h.newGame); on('join', h.join); on('rematch', h.rematch); on('restart', h.restart);
  on('retry', h.retry); on('yes', h.confirmYes); on('no', h.confirmNo);
  root.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => h.flip(Number(b.dataset.card))));
  root.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => h.setSize(b.dataset.size)));
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => h.setMode(b.dataset.mode)));
  root.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => h.setBotLevel(b.dataset.level)));
}
