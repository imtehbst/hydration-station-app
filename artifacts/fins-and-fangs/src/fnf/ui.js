// Fins & Fangs — rendering. Cards are kept as persistent DOM nodes so
// flips animate; everything else is re-rendered from the view each time.
import { CAST, byId, deckFor, questionsFor } from './cast.js';
import { faceHTML, cardBackHTML } from './art.js';
import { seriesInfo, lockedQuestions, boardOrder, boardView } from './rules.js';
import { LEVELS, LEVEL_LABEL, isBot } from '../shared/bots.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOGO = '<h1 class="logo"><span class="f">Fins</span> <span class="amp">&amp;</span> Fangs</h1>';
const SVG = new Map(CAST.map((c) => [c.id, faceHTML(c)])); // picture, or drawn SVG fallback
const BACK = cardBackHTML();

let boardEl = null; // persistent board DOM
let cardEls = new Map();
let fresh = false;     // board just built: set flips without animating
let orderKey = '';
let sideKey = '';
let endKey = '';
let screenKey = '';
let lastMode = '';
let builtV = 0; // deck version the board was built for (v1 = 24 cards, v2 = 32)

const nameOf = (view, seat) => {
  const p = view.state?.seats[seat];
  if (!p) return 'Someone';
  if (p.uid === view.me.uid) return 'You';
  return view.names[p.uid] || p.name || 'Your friend';
};

// "First to 3" series: where it stands, or who took it.
function seriesLine(view) {
  const info = seriesInfo(view.state);
  if (!info) return '';
  const [a, b] = info.wins;
  if (info.winner !== null) return `<div class="series won">🏆 ${esc(nameOf(view, info.winner))} ${nameOf(view, info.winner) === 'You' ? 'win' : 'wins'} the series ${Math.max(a, b)}–${Math.min(a, b)}!</div>`;
  return `<div class="series">Series (first to ${info.to}): ${esc(nameOf(view, 0))} <b>${a}</b> – <b>${b}</b> ${esc(nameOf(view, 1))}</div>`;
}
const seriesToggle = (view) => `<p><button class="ghost seriesbtn ${view.series ? 'on' : ''}" data-act="series" aria-pressed="${view.series}">🏆 ${view.series ? 'Series: first to 3 wins' : 'Single game'}</button><br><small>${view.series ? 'Rematches keep counting until someone has 3 wins.' : 'Tap to make it a first-to-3 series.'}</small></p>`;

function scoreLine(view) {
  const s = view.state;
  if (!s || !s.seats[1] || isBot(s.seats[1])) return ''; // no records against bots
  const [a, b] = s.seats;
  return `<div class="score">${esc(nameOf(view, 0))} <b>${s.score[a.uid] || 0}</b> – <b>${s.score[b.uid] || 0}</b> ${esc(nameOf(view, 1))}</div>`;
}

// root holds a mode bar (With friend | Vs bot) above the game itself
function frame(root) {
  let body = root.querySelector(':scope > .gamebody');
  if (!body) {
    root.innerHTML = '<nav class="modebar" hidden></nav><div class="gamebody"></div>';
    body = root.querySelector(':scope > .gamebody');
    boardEl = null;
    cardEls = new Map();
    screenKey = '';
  }
  return { bar: root.querySelector(':scope > .modebar'), body };
}

function renderModeBar(bar, view, h) {
  const html = view.hasBot
    ? ['friend', 'bot'].map((m) => `<button class="${view.mode === m ? 'on' : ''}" data-mode="${m}">${m === 'bot' ? '🤖 Vs bot' : '👥 With friend'}</button>`).join('')
    : '';
  if (bar.dataset.k === html) return;
  bar.dataset.k = html;
  bar.innerHTML = html;
  bar.hidden = !html;
  bar.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => h.setMode(b.dataset.mode)));
}

export function render(root, view, h) {
  const { bar, body } = frame(root);
  renderModeBar(bar, view, h);
  if (view.mode !== lastMode) { lastMode = view.mode; boardEl = null; cardEls = new Map(); screenKey = ''; }
  if (view.screen !== 'board' && view.screen !== 'end') {
    boardEl = null;
    cardEls = new Map();
    const html = screenHTML(view);
    if (html === screenKey && body.firstChild) { renderConfirm(root, view, h); renderToast(root, view); return; }
    screenKey = html;
    body.innerHTML = html;
    body.querySelector('[data-act="new"]')?.addEventListener('click', h.newGame);
    body.querySelector('[data-act="join"]')?.addEventListener('click', h.join);
    body.querySelector('[data-act="retry"]')?.addEventListener('click', h.retry);
    body.querySelector('[data-act="cancelpick"]')?.addEventListener('click', h.cancelPick);
    body.querySelector('[data-act="series"]')?.addEventListener('click', h.toggleSeries);
    body.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => h.botStart(b.dataset.level)));
  } else {
    renderBoard(body, view, h);
  }
  renderConfirm(root, view, h);
  renderToast(root, view);
}

function renderConfirm(root, view, h) {
  let el = root.querySelector('.fnf-confirm');
  if (!view.confirm) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.className = 'overlay confirm fnf-confirm'; root.appendChild(el); }
  if (el.dataset.text === view.confirm.text) return;
  el.dataset.text = view.confirm.text;
  el.innerHTML = `<div class="endbox"><p style="font-size:18px">${esc(view.confirm.text)}</p>
    <button class="big" data-act="yes">Yes</button><button class="ghost" data-act="no">Cancel</button></div>`;
  el.querySelector('[data-act="yes"]').addEventListener('click', h.confirmYes);
  el.querySelector('[data-act="no"]').addEventListener('click', h.confirmNo);
}

function screenHTML(view) {
  const banner = view.banner ? `<div class="banner">${esc(view.banner)}</div>` : '';
  if (view.screen === 'loading') return `${LOGO}<p class="msg">Summoning the moody ones…</p>`;
  if (view.screen === 'message') {
    const btn = view.action === 'new' ? '<button class="big" data-act="new">New game</button>'
      : view.action === 'retry' ? '<button class="big" data-act="retry">Retry</button>' : '';
    return `${LOGO}<p class="msg">${esc(view.message)}</p><div class="lobby">${btn}</div>`;
  }
  // lobby
  const s = view.state;
  const preview = ['c05', 'c01', 'c13', 'c20', 'c09', 'c17']
    .map((id, i) => `<span style="--r:${(i - 2.5) * 4}deg">${SVG.get(id)}</span>`).join('');
  let body;
  if (view.screen === 'botlobby') {
    body = '<p>Play a bot on your own — your game with your friend stays just as it is.</p><p><b>Pick a bot:</b></p>' +
      `<div class="levels">${LEVELS.map((l) => `<button class="big level" data-level="${l}">🤖 ${LEVEL_LABEL[l]}</button>`).join('')}</div>` +
      (s ? '<button class="ghost" data-act="cancelpick">Cancel</button>' : '');
  } else if (!s) {
    body = `<p>Pick a secret character. Ask yes/no questions. Guess theirs first.</p>${seriesToggle(view)}<button class="big" data-act="new">New game</button>`;
  } else if (s.status === 'waiting' && s.seats[0].uid === view.me.uid) {
    body = `<p>Waiting for your friend to open this link and tap <b>Join</b>…${s.series ? ' (🏆 first to 3)' : ''}</p>${seriesToggle(view)}<button class="ghost" data-act="new">Start over</button>`;
  } else if (s.status === 'waiting') {
    body = `<p><b>${esc(nameOf(view, 0))}</b> is waiting for an opponent${s.series ? ' — a <b>🏆 first-to-3 series</b>' : ''}.</p><button class="big" data-act="join">Join game</button>`;
  } else {
    body = '';
  }
  return `${banner}<div class="lobby"><h2><span style="color:var(--teal)">Fins</span> <span style="color:var(--blood)">&amp;</span> Fangs</h2>
    <div class="preview">${preview}</div>${body}${scoreLine(view)}</div>`;
}

function renderBoard(root, view, h) {
  const s = view.state;
  const seat = view.mySeat;
  const playing = seat !== null;
  if (!boardEl || !root.contains(boardEl) || builtV !== s.v) {
    builtV = s.v;
    root.innerHTML = `<div class="banner" hidden></div><header class="top">${LOGO}<div class="turn"></div></header>
      <div class="board"><div class="boardcol"><div class="viewbar" hidden></div><section class="grid"></section></div><aside class="side"></aside></div><div class="overlay" hidden></div>`;
    boardEl = root.querySelector('.board');
    const grid = boardEl.querySelector('.grid');
    cardEls = new Map();
    fresh = true;
    orderKey = sideKey = endKey = screenKey = '';
    const deck = deckFor(s.v);
    grid.classList.toggle('d32', deck.length === 32);
    for (const c of deck) {
      const b = document.createElement('button');
      b.className = 'card';
      b.dataset.id = c.id;
      b.setAttribute('aria-label', c.name);
      b.innerHTML = `<div class="inner"><div class="face front">${SVG.get(c.id)}<span class="nm">${esc(c.name)}</span></div><div class="face back">${BACK}</div></div>`;
      b.addEventListener('click', () => h.cardClick(c.id));
      grid.appendChild(b);
      cardEls.set(c.id, b);
    }
  }
  const banner = root.querySelector('.banner');
  banner.hidden = !view.banner;
  banner.textContent = view.banner || '';

  // card order: each player's own shuffle for this round
  const order = boardOrder(s, view.me.uid || 'watcher');
  const ok = order.join();
  if (ok !== orderKey) {
    orderKey = ok;
    const grid = boardEl.querySelector('.grid');
    for (const id of order) grid.appendChild(cardEls.get(id));
  }

  // cards
  const bv = boardView(s, seat, view.viewSeat ?? null);
  const up = new Set(bv.up);
  const viewingOther = playing && bv.seat !== seat;
  const vb = root.querySelector('.viewbar');
  const showBar = viewingOther || (!playing && bv.seat !== null);
  vb.hidden = !showBar;
  if (showBar) {
    vb.innerHTML = `👀 <b>${esc(nameOf(view, bv.seat))}</b>'s view · ${up.size} card${up.size === 1 ? '' : 's'} still face-up` +
      (playing ? ' <button class="ghost" data-act="back">Back to my view</button>' : '');
    vb.querySelector('[data-act="back"]')?.addEventListener('click', () => h.viewBoard(null));
  }
  boardEl.querySelector('.grid').classList.toggle('viewing', viewingOther);
  let k = 0;
  for (const id of order) {
    const el = cardEls.get(id);
    const down = !up.has(id);
    const peek = down && bv.interactive && view.peeks.has(id);
    const showDown = down && !peek;
    const inner = el.querySelector('.inner');
    if (fresh) {
      inner.style.transition = 'none';
    } else if (el.classList.contains('down') !== showDown) {
      inner.style.transitionDelay = showDown ? `${(k++) * 30}ms` : '0ms';
    }
    el.classList.toggle('down', showDown);
    el.classList.toggle('peek', peek);
    el.disabled = !bv.interactive;
  }
  if (fresh) {
    fresh = false;
    void boardEl.offsetWidth; // apply the no-transition state before re-enabling
    setTimeout(() => cardEls.forEach((el) => { el.querySelector('.inner').style.transition = ''; }), 50);
  }
  boardEl.querySelector('.grid').classList.toggle('guessing', view.guessMode);

  // turn banner
  const turn = root.querySelector('.turn');
  const oppSeat = playing ? 1 - seat : null;
  const myTurn = playing && s.status === 'playing' && s.turn === seat;
  turn.classList.toggle('mine', myTurn);
  const dot = playing && !view.bot ? `<span class="dot ${view.peerOnline ? 'on' : ''}" title="${view.peerOnline ? 'Online now' : 'Not here right now'}"></span>` : '';
  const waiting = s.lastChance ? `You found them! ${esc(nameOf(view, oppSeat))} gets one last guess to tie…`
    : view.bot ? `${esc(nameOf(view, oppSeat))} is thinking…` : `Waiting for ${esc(nameOf(view, oppSeat))}…`;
  const mine = s.lastChance ? 'Last chance! They found your character — guess theirs to tie' : 'Your turn';
  turn.innerHTML = !playing ? (s.lastChance ? 'Last chance to tie…' : 'Watching')
    : s.status !== 'playing' ? `Game over ${dot}`
      : myTurn ? `${mine} ${dot}` : `${waiting} ${dot}`;

  // side panel
  const side = boardEl.querySelector('.side');
  let html = '';
  if (playing) {
    const mine = byId(s.secrets[seat]);
    html += `<div class="secret">${SVG.get(mine.id)}<div><small>Your secret character</small><b>${esc(mine.name)}</b><small>${up.size} card${up.size === 1 ? '' : 's'} still face-up</small></div></div>`;
    const locked = lockedQuestions(s, seat);
    html += `<div class="qs">${questionsFor(s.v).map((q) => `<button class="q ${locked.has(q.id) ? '' : 'idle'}" data-q="${q.id}" ${(!myTurn || locked.has(q.id) || view.guessMode || s.lastChance) ? 'disabled' : ''}>${esc(q.text)}</button>`).join('')}</div>`;
    const guessLabel = s.lastChance && myTurn ? 'Last chance: tap a face-up card to guess'
      : view.guessMode ? 'Tap a face-up card to guess… (cancel)' : 'Make a guess';
    html += `<button class="guessbtn ${view.guessMode ? 'on' : ''}" data-act="guess" ${myTurn && !viewingOther ? '' : 'disabled'}>${guessLabel}</button>`;
    html += viewingOther
      ? '<button class="viewbtn on" data-view="mine">← Back to my view</button>'
      : `<button class="viewbtn" data-view="${1 - seat}">👀 Their view</button>`;
  } else {
    html += `<p>${esc(nameOf(view, 0))} vs ${esc(nameOf(view, 1))}. You're watching.</p>`;
    html += `<div class="viewpick">${[0, 1].map((k) => `<button class="viewbtn ${bv.seat === k ? 'on' : ''}" data-view="${k}">👀 ${esc(nameOf(view, k))}'s view</button>`).join('')}</div>`;
  }
  html += `<ol class="log">${s.log.map((e) => logLine(view, e)).join('')}</ol>`;
  html += `<div class="foot">${seriesLine(view)}${scoreLine(view)}${playing ? '<button class="ghost" data-act="new">New game</button>' : ''}</div>`;
  if (html === sideKey) { renderEnd(root, view, h, s, seat, playing); return; }
  sideKey = html;
  side.innerHTML = html;
  side.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => h.ask(b.dataset.q)));
  side.querySelector('[data-act="guess"]')?.addEventListener('click', h.toggleGuess);
  side.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => h.viewBoard(b.dataset.view === 'mine' ? null : Number(b.dataset.view))));
  side.querySelector('[data-act="new"]')?.addEventListener('click', h.newGame);

  renderEnd(root, view, h, s, seat, playing);
}

function renderEnd(root, view, h, s, seat, playing) {
  const ov = root.querySelector('.overlay:not(.fnf-confirm)');
  ov.hidden = s.status !== 'over';
  if (s.status === 'over') {
    const won = s.winner === seat;
    const title = s.draw ? 'Draw! 🤝 You both found each other'
      : playing ? (won ? 'You win! 🦈' : `${esc(nameOf(view, s.winner))} wins 🦇`) : `${esc(nameOf(view, s.winner))} wins`;
    const fig = (st) => `<figure>${SVG.get(s.secrets[st])}<figcaption>${esc(nameOf(view, st))}: ${esc(byId(s.secrets[st]).name)}</figcaption></figure>`;
    const html = `<div class="endbox"><h2>${title}</h2><div class="reveal">${fig(0)}${fig(1)}</div>${seriesLine(view)}${scoreLine(view)}
      ${playing ? `<button class="big" data-act="rematch">${view.bot ? 'Play again' : seriesInfo(s) ? (seriesInfo(s).winner !== null ? 'New series' : 'Next game') : 'Rematch'}</button>` : ''}</div>`;
    if (html === endKey) return;
    endKey = html;
    ov.innerHTML = html;
    ov.querySelector('[data-act="rematch"]')?.addEventListener('click', h.rematch);
  }
}

function logLine(view, e) {
  const who = esc(nameOf(view, e.seat));
  if (e.kind === 'ask') {
    const q = questionsFor(2).find((x) => x.id === e.q).text; // v2 holds every question
    return `<li>${who} asked: ${esc(q)} <span class="${e.answer ? 'yes' : 'no'}">${e.answer ? 'Yes' : 'No'}</span></li>`;
  }
  const n = esc(byId(e.charId).name);
  return `<li>${who} guessed ${n}: <span class="${e.correct ? 'yes' : 'no'}">${e.correct ? 'Right!' : 'Wrong'}</span></li>`;
}

function renderToast(root, view) {
  let t = root.querySelector('.fnf-toast');
  if (!view.toast) { t?.remove(); return; }
  if (!t) { t = document.createElement('div'); t.className = 'toast fnf-toast'; root.appendChild(t); }
  t.textContent = view.toast;
}
