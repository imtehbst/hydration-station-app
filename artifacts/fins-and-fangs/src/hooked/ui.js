// Hooked! — rendering. Pure-ish: render(root, view, handlers) rebuilds the
// game area, skipping the DOM write when nothing changed (no lost taps).
import { SHARKS, SIZES, cellsOf, colName, squareName } from './fleets.js';
import { tankView, sharksLeft } from './rules.js';
import { sharkImg, HIT_SVG, MISS_SVG } from './art.js';
import { LEVELS, LEVEL_LABEL, isBot } from '../shared/bots.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOGO = '<h1 class="logo"><span class="f">Hooked</span><span class="amp">!</span></h1>';

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

function spriteHTML(sh, size, caught) {
  const u = 100 / size;
  const cc = caught ? ' caught' : '';
  const img = `<img src="${sharkImg(sh.id)}" alt="${esc(SHARKS[sh.id].name)}" draggable="false">`;
  if (sh.dir === 'h') {
    return `<div class="sprite${cc}" style="left:${sh.c * u}%;top:${sh.r * u}%;width:${sh.len * u}%;height:${u}%">${img}</div>`;
  }
  // vertical: lay the strip horizontally then rotate 90° about its top-left
  return `<div class="sprite v${cc}" style="left:${(sh.c + 1) * u}%;top:${sh.r * u}%;width:${sh.len * u}%;height:${u}%">${img}</div>`;
}

// One tank. kind: 'mine' | 'theirs'. opts.click: which handler cells use.
function tankHTML(tv, { kind, clickable }) {
  const n = tv.size;
  const marks = new Map(tv.marks.map((m) => [`${m.r},${m.c}`, m.hit]));
  const empty = new Set((tv.empty || []).map((m) => `${m.r},${m.c}`));
  const caught = new Set(tv.caught || []);
  let cells = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const k = `${r},${c}`;
      const m = marks.get(k);
      const auto = m === undefined && empty.has(k);
      const cls = ['cell', m === true ? 'hit' : m === false ? 'miss' : '', auto ? 'auto' : ''].join(' ');
      const mark = m === true ? HIT_SVG : m === false ? MISS_SVG : auto ? '<i class="dotmark"></i>' : '';
      const dis = !clickable || (kind === 'theirs' && (m !== undefined || auto)) ? 'disabled' : '';
      cells += `<button class="${cls}" data-${kind}="${r},${c}" aria-label="${squareName(r, c)}" ${dis}>${mark}</button>`;
    }
  }
  const cols = Array.from({ length: n }, (_, c) => `<span>${colName(c)}</span>`).join('');
  const rows = Array.from({ length: n }, (_, r) => `<span>${r + 1}</span>`).join('');
  return `<div class="tankwrap" style="--n:${n}"><div class="cols">${cols}</div><div class="rows">${rows}</div>` +
    `<div class="tank ${kind}"><div class="cells">${cells}</div><div class="sprites">${tv.sharks.map((sh) => spriteHTML(sh, n, caught.has(sh.id))).join('')}</div></div></div>`;
}

function leftList(s, seat, label) {
  const left = new Set(sharksLeft(s, seat));
  const fleet = s.fleets[seat] || [];
  const ids = fleet.length ? fleet.map((x) => x.id) : [...left];
  return `<div class="left"><small>${esc(label)}</small>${ids.map((id) => `<span class="${left.has(id) ? '' : 'gone'}">${esc(SHARKS[id].name)}</span>`).join('')}</div>`;
}

function logHTML(view) {
  const s = view.state;
  return `<ol class="log">${s.casts.map((x) => {
    const who = esc(nameOf(view, x.seat));
    const res = x.hit ? '<span class="yes">Bite!</span>' : '<span class="no">Splash…</span>';
    const caught = x.caught ? ` — hooked ${x.seat === view.mySeat ? 'their' : 'a'} <b>${esc(SHARKS[x.caught].name)}</b>!` : '';
    return `<li>${who} cast at ${squareName(x.r, x.c)} — ${res}${caught}</li>`;
  }).join('')}</ol>`;
}

function lobbyHTML(view) {
  const s = view.state;
  const sizes = SIZES.map((n) => `<button class="big size" data-new="${n}">${n}×${n}</button>`).join('');
  let body;
  if (!s || view.choosingSize) {
    const cancel = view.choosingSize && s ? '<button class="ghost" data-act="cancelsize">Cancel</button>' : '';
    const levels = view.bot
      ? '<p>Play a bot on your own — your game with your friend stays just as it is.</p><p><b>Pick a bot:</b></p>' +
        `<div class="levels">${LEVELS.map((l) => `<button class="big level ${view.botLevel === l ? 'picked' : ''}" data-level="${l}">🤖 ${LEVEL_LABEL[l]}</button>`).join('')}</div>`
      : '<p>Hide your sharks. Cast into their tank. A bite means cast again!</p>';
    const salvo = `<p><button class="ghost hk-salvo ${view.salvo ? 'on' : ''}" data-act="salvo" aria-pressed="${view.salvo}">💥 Salvo: ${view.salvo ? 'on' : 'off'}</button><br><small>${view.salvo ? 'Salvo: each turn you get one cast per shark you still have. Bites don’t give extra casts.' : 'Classic: a bite means cast again; a splash ends your turn.'}</small></p>`;
    body = `${levels}${salvo}<p><b>Pick a tank size${view.bot ? ' to start' : ''}:</b></p><div>${sizes}</div>${cancel}`;
  }
  else if (s.status === 'waiting' && s.seats[0].uid === view.me.uid) body = `<p>Waiting for your friend to tap <b>Join</b>… (${s.size}×${s.size} tank${s.salvo ? ', 💥 Salvo' : ''})</p><button class="ghost" data-act="restart">Start over</button>`;
  else if (s.status === 'waiting') body = `<p><b>${esc(nameOf(view, 0))}</b> set up a ${s.size}×${s.size} tank${s.salvo ? ' with <b>💥 Salvo</b> rules (one cast per shark you have left)' : ''}.</p><button class="big" data-act="join">Join game</button>`;
  else body = '';
  return `<div class="lobby"><h2>🎣 Hooked!</h2>${body}${scoreLine(view)}</div>`;
}

function placingHTML(view) {
  const s = view.state;
  const seat = view.mySeat;
  const other = 1 - seat;
  const otherStatus = s.fleets[other] ? `${esc(nameOf(view, other))} is ready.` : `${esc(nameOf(view, other))} is still placing…`;
  if (s.fleets[seat]) {
    const tv = tankView(s, seat, seat);
    return `<div class="hk-top">${LOGO}<div class="turn">Ready! ${otherStatus}</div></div>` +
      `<div class="hk-one">${tankHTML(tv, { kind: 'mine', clickable: false })}</div>` +
      '<div class="foot"><span></span><button class="ghost" data-act="restart">New game</button></div>';
  }
  const draft = view.draft || [];
  const placedIds = new Set(draft.map((x) => x.id));
  const list = view.fleetList.map((f) => {
    const on = view.pick === f.id;
    return `<button class="sharkbtn ${on ? 'on' : ''} ${placedIds.has(f.id) ? 'placed' : ''}" data-pick="${f.id}">${esc(SHARKS[f.id].name)} · ${f.len}${placedIds.has(f.id) ? ' ✓' : ''}</button>`;
  }).join('');
  const tv = { size: s.size, sharks: draft, marks: [] };
  return `<div class="hk-top">${LOGO}<div class="turn">Hide your sharks · ${otherStatus}</div></div>` +
    `<div class="hk-place"><div>${tankHTML(tv, { kind: 'mine', clickable: true })}</div>` +
    `<aside class="side"><p>${view.pick ? `Tap a square to place your <b>${esc(SHARKS[view.pick].name)}</b> (${view.dir === 'h' ? 'across' : 'down'}).` : 'Tap a shark in the tank to pick it up, or pick one below.'}</p>` +
    `<div class="sharklist">${list}</div>` +
    `<div class="row"><button class="ghost" data-act="rotate">↻ Rotate (${view.dir === 'h' ? 'across' : 'down'})</button><button class="ghost" data-act="shuffle">🎲 Shuffle</button></div>` +
    `<button class="big" data-act="ready" ${view.draftValid ? '' : 'disabled'}>Ready</button>` +
    '<button class="ghost" data-act="restart">New game</button></aside></div>';
}

function fishingHTML(view) {
  const s = view.state;
  const seat = view.mySeat;
  const playing = seat !== null;
  const over = s.status === 'over';
  const myTurn = playing && !over && s.turn === seat;
  const dot = playing && !view.bot ? `<span class="dot ${view.peerOnline ? 'on' : ''}"></span>` : '';
  const waiting = view.bot ? `${esc(nameOf(view, 1 - seat))} is thinking…` : `Waiting for ${esc(nameOf(view, 1 - seat))}…`;
  const salvoLeft = s.salvo && !over && Number.isInteger(s.shots) ? ` · 💥 ${s.shots} cast${s.shots === 1 ? '' : 's'} left` : '';
  const turn = !playing ? 'Watching' : over ? `Game over ${dot}` : myTurn ? `Your turn — cast into their tank${salvoLeft} ${dot}` : `${waiting}${salvoLeft} ${dot}`;
  const mineSeat = playing ? seat : 0;
  const theirSeat = 1 - mineSeat;
  const mine = tankHTML(tankView(s, seat, mineSeat), { kind: 'mine', clickable: false });
  const theirs = tankHTML(tankView(s, seat, theirSeat), { kind: 'theirs', clickable: myTurn });
  const mineTitle = playing ? 'Your tank' : `${esc(nameOf(view, 0))}'s tank`;
  const theirTitle = playing ? `${esc(nameOf(view, theirSeat))}'s tank` : `${esc(nameOf(view, 1))}'s tank`;
  const tabs = `<div class="hk-tabs"><button class="${view.mobileTab === 'mine' ? 'on' : ''}" data-mtab="mine">${mineTitle}</button><button class="${view.mobileTab === 'theirs' ? 'on' : ''}" data-mtab="theirs">${theirTitle}</button></div>`;
  let end = '';
  if (over) {
    const won = s.winner === seat;
    end = `<div class="hk-end"><h2>${playing ? (won ? 'You win! 🎣' : `${esc(nameOf(view, s.winner))} wins 🦈`) : `${esc(nameOf(view, s.winner))} wins`}</h2>${scoreLine(view)}${playing ? `<button class="big" data-act="rematch">${view.bot ? 'Play again' : 'Rematch'}</button>` : ''}</div>`;
  }
  return `<div class="hk-top">${LOGO}<div class="turn ${myTurn ? 'mine' : ''}">${turn}</div></div>${end}${tabs}` +
    `<div class="hk-tanks show-${view.mobileTab}"><section class="tankbox mine"><h3>${mineTitle}</h3>${mine}${leftList(s, mineSeat, playing ? 'Your sharks' : 'Sharks')}</section>` +
    `<section class="tankbox theirs"><h3>${theirTitle}</h3>${theirs}${leftList(s, theirSeat, 'Their sharks')}</section></div>` +
    `<div class="hk-foot">${logHTML(view)}<div class="foot">${scoreLine(view)}${playing ? '<button class="ghost" data-act="restart">New game</button>' : ''}</div></div>`;
}

function screenHTML(view) {
  const banner = view.banner ? `<div class="banner">${esc(view.banner)}</div>` : '';
  if (view.screen === 'loading') return `${LOGO}<p class="msg">Baiting the hooks…</p>`;
  if (view.screen === 'message') {
    const btn = view.action === 'new' ? '<button class="big" data-act="restart">New game</button>' : view.action === 'retry' ? '<button class="big" data-act="retry">Retry</button>' : '';
    return `${LOGO}<p class="msg">${esc(view.message)}</p><div class="lobby">${btn}</div>`;
  }
  if (view.screen === 'lobby') return banner + lobbyHTML(view);
  if (view.screen === 'placing') return banner + placingHTML(view);
  return banner + fishingHTML(view);
}

function modeBarHTML(view) {
  if (!view.hasBot) return '';
  return `<nav class="modebar">${['friend', 'bot'].map((m) => `<button class="${view.mode === m ? 'on' : ''}" data-mode="${m}">${m === 'bot' ? '🤖 Vs bot' : '👥 With friend'}</button>`).join('')}</nav>`;
}

export function render(root, view, h) {
  const html = modeBarHTML(view) + `<div class="hk hk-${view.screen}">${screenHTML(view)}</div>` +
    (view.confirm ? `<div class="overlay"><div class="endbox"><p style="font-size:18px">${esc(view.confirm.text)}</p><button class="big" data-act="yes">Yes</button><button class="ghost" data-act="no">Cancel</button></div></div>` : '') +
    (view.toast ? `<div class="toast hk-toast">${esc(view.toast)}</div>` : '');
  if (html === lastHTML && root.firstChild) return;
  lastHTML = html;
  root.innerHTML = html;
  root.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => h.newGame(Number(b.dataset.new))));
  root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => h.pickShark(b.dataset.pick)));
  root.querySelectorAll('[data-mine]').forEach((b) => b.addEventListener('click', () => { const [r, c] = b.dataset.mine.split(',').map(Number); h.mineCell(r, c); }));
  root.querySelectorAll('[data-theirs]').forEach((b) => b.addEventListener('click', () => { const [r, c] = b.dataset.theirs.split(',').map(Number); h.cast(r, c); }));
  root.querySelectorAll('[data-mtab]').forEach((b) => b.addEventListener('click', () => h.mobileTab(b.dataset.mtab)));
  const on = (act, fn) => root.querySelector(`[data-act="${act}"]`)?.addEventListener('click', fn);
  on('join', h.join); on('rotate', h.rotate); on('shuffle', h.shuffle); on('ready', h.ready);
  on('rematch', h.rematch); on('restart', h.restart); on('retry', h.retry); on('yes', h.confirmYes); on('no', h.confirmNo);
  on('cancelsize', h.cancelSize); on('salvo', h.toggleSalvo);
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => h.setMode(b.dataset.mode)));
  root.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => h.setBotLevel(b.dataset.level)));
}
