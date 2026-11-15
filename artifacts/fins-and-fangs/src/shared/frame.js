// Rendering shared by the newer two-player games: the With friend / Vs bot bar,
// the start screen, the top line, the end box and the side panel. Each game
// supplies its board and what to bind. The DOM write is skipped when nothing
// changed (no lost taps).
import { LEVELS, LEVEL_LABEL, isBot } from './bots.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function nameOf(view, seat) {
  const p = view.state?.seats[seat];
  if (!p) return 'Someone';
  if (p.uid === view.me.uid) return 'You';
  return view.names[p.uid] || p.name || 'Your friend';
}
// "You win" / "Sam wins"
export const wins = (view, seat) => `${esc(nameOf(view, seat))} ${nameOf(view, seat) === 'You' ? 'win' : 'wins'}`;

export function scoreLine(view) {
  const s = view.state;
  if (!s || !s.seats[1] || isBot(s.seats[1])) return ''; // no records against bots
  const [a, b] = s.seats;
  return `<div class="score">${esc(nameOf(view, 0))} <b>${s.score[a.uid] || 0}</b> – <b>${s.score[b.uid] || 0}</b> ${esc(nameOf(view, 1))}</div>`;
}

// A row of choices for the start screen: picker('size', {small: 'Small', ...}, view)
export const picker = (key, choices, view, label = '') => `<div class="mm-sizes" role="group" aria-label="${esc(label || key)}">${Object.entries(choices)
  .map(([k, text]) => `<button class="${String(view.opts[key]) === k ? 'on' : ''}" data-opt="${key}" data-val="${k}">${text}</button>`).join('')}</div>`;

// The play screen's frame. turn: text for the pill; end: title when the game is over ('' while playing).
export function playShell(view, { logo, turn, myTurn, end = '', endExtra = '', board, players, tag = '', mainCls = '', again = '' }) {
  const s = view.state;
  const playing = view.mySeat !== null;
  const dot = playing && !view.bot ? ` <span class="dot ${view.peerOnline ? 'on' : ''}"></span>` : '';
  const endBox = end ? `<div class="tt-end"><h2>${end}</h2>${endExtra}${playing ? `<button class="big" data-act="rematch">${again || (view.bot ? 'Play again' : 'Rematch')}</button>` : ''}</div>` : '';
  return `<div class="tt-top">${logo}${tag ? `<span class="tt-tag">${tag}</span>` : ''}<div class="turn ${myTurn ? 'mine' : ''}">${turn}${dot}</div></div>${endBox}` +
    `<div class="tt-main ${mainCls}">${board}<aside class="tt-side"><div class="players">${players}</div>` +
    `<div class="foot">${scoreLine(view)}${playing ? '<button class="ghost" data-act="restart">New game</button>' : ''}</div></aside></div>`;
}

// One line in the side panel.
export const playerRow = (view, seat, { icon = '', sub = '', count = null, now = false }) =>
  `<div class="pl ${now ? 'now' : ''}">${icon}<span>${esc(nameOf(view, seat))}<small>${sub}</small></span>${count === null ? '' : `<b>${count}</b>`}</div>`;

function lobbyHTML(view, cfg) {
  const s = view.state;
  const options = cfg.options ? cfg.options(view) : '';
  let body;
  if (!s) {
    body = (view.bot
      ? `<p>${cfg.botBlurb || 'Play a bot on your own — your game with your friend stays just as it is.'}</p><p><b>Pick a bot:</b></p>` +
        `<div class="levels">${LEVELS.map((l) => `<button class="big level ${view.botLevel === l ? 'picked' : ''}" data-level="${l}">🤖 ${LEVEL_LABEL[l]}</button>`).join('')}</div>`
      : `<p>${cfg.blurb}</p>`) + options + `<button class="big" data-act="new">${view.bot ? 'Start' : 'Start a game'}</button>`;
  } else if (s.seats[0].uid === view.me.uid) {
    body = `<p>Waiting for your friend to tap <b>Join</b>…${cfg.waiting ? ` (${cfg.waiting(s)})` : ''}</p><button class="ghost" data-act="restart">Start over</button>`;
  } else {
    body = `<p><b>${esc(nameOf(view, 0))}</b> wants a game${cfg.waiting ? ` (${cfg.waiting(s)})` : ''}.</p><button class="big" data-act="join">Join game</button>`;
  }
  return `<div class="lobby">${cfg.hero || ''}<h2>${cfg.title}</h2>${body}${scoreLine(view)}</div>`;
}

function screenHTML(view, cfg) {
  const banner = view.banner ? `<div class="banner">${esc(view.banner)}</div>` : '';
  if (view.screen === 'loading') return `${cfg.logo}<p class="msg">${cfg.loading || 'Chumming the water…'}</p>`;
  if (view.screen === 'message') {
    const btn = view.action === 'new' ? '<button class="big" data-act="new">New game</button>' : view.action === 'retry' ? '<button class="big" data-act="retry">Retry</button>' : '';
    return `${cfg.logo}<p class="msg">${esc(view.message)}</p><div class="lobby">${btn}</div>`;
  }
  if (view.screen === 'lobby') return banner + lobbyHTML(view, cfg);
  return banner + cfg.play(view);
}

function modeBarHTML(view) {
  if (!view.hasBot) return '';
  return `<nav class="modebar">${['friend', 'bot'].map((m) => `<button class="${view.mode === m ? 'on' : ''}" data-mode="${m}">${m === 'bot' ? '🤖 Vs bot' : '👥 With friend'}</button>`).join('')}</nav>`;
}

// cfg: { cls, logo, title, blurb, botBlurb?, hero?, options?(view), waiting?(s), loading?, play(view), bind?(root, h, view) }
export function renderGame(root, view, h, cfg) {
  const html = modeBarHTML(view) + `<div class="tt ${cfg.cls} tt-${view.screen}">${screenHTML(view, cfg)}</div>` +
    (view.confirm ? `<div class="overlay"><div class="endbox"><p style="font-size:18px">${esc(view.confirm.text)}</p><button class="big" data-act="yes">Yes</button><button class="ghost" data-act="no">Cancel</button></div></div>` : '') +
    (view.toast ? `<div class="toast tt-toast">${esc(view.toast)}</div>` : '');
  if (html === cfg.lastHTML && root.firstChild) return;
  // keep what's being typed (Hangshark's word box) across a redraw
  const typing = root.querySelector('input[data-keep]');
  const kept = typing ? { value: typing.value, focused: document.activeElement === typing } : null;
  cfg.lastHTML = html;
  root.innerHTML = html;
  const on = (act, fn) => root.querySelectorAll(`[data-act="${act}"]`).forEach((b) => b.addEventListener('click', fn));
  on('new', h.newGame); on('join', h.join); on('rematch', h.rematch); on('restart', h.restart);
  on('retry', h.retry); on('yes', h.confirmYes); on('no', h.confirmNo);
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => h.setMode(b.dataset.mode)));
  root.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => h.setBotLevel(b.dataset.level)));
  root.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => h.setOpt(b.dataset.opt, b.dataset.val)));
  const again = root.querySelector('input[data-keep]');
  if (kept && again) { again.value = kept.value; if (kept.focused) again.focus(); }
  cfg.bind?.(root, h, view);
}
