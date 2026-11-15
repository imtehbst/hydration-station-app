// Snakes & ladders tab — rendering. render(root, view, handlers) rebuilds the
// game area, skipping the DOM write when nothing changed (no lost taps).
// How it looks comes from the viewer's theme (themes.js); the rules don't care.
import { BUBBLES, EELS, GOAL, squareXY, moveFrom } from './rules.js';
import { THEMES, THEME_IDS, fill } from './themes.js';
import { isBot } from '../shared/bots.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const logo = (T) => `<h1 class="logo"><span class="f">${esc(T.name[0])}</span> <span class="amp">&amp;</span> <span class="b">${esc(T.name[1])}</span></h1>`;
const DOWNS = Object.entries(EELS).map(([a, b]) => [Number(a), b]);
const UPS = Object.entries(BUBBLES).map(([a, b]) => [Number(a), b]);

let lastHTML = '';

// centre of square n in the 0..100 board space
function centre(n) {
  const { r, c } = squareXY(n);
  return [c * 10 + 5, (9 - r) * 10 + 5];
}

// Points along a wavy line from square a to square b (0..100 space).
function wavyPts(a, b, { waves, amp, phase = 0, steps = 40 }) {
  const [ax, ay] = centre(a);
  const [bx, by] = centre(b);
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const w = waves ?? Math.max(1.5, len / 22);
  const pts = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const o = Math.sin(t * Math.PI * 2 * w + phase) * amp * Math.sin(Math.min(1, t * 4) * Math.PI / 2);
    pts.push([ax + dx * t + nx * o, ay + dy * t + ny * o]);
  }
  return pts;
}
const f2 = (n) => n.toFixed(2);
const pathOf = (pts) => 'M' + pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join(' L');
const wavy = (a, b, o) => pathOf(wavyPts(a, b, o));

// A tapered body around a centre line: w0 wide at the first point, w1 at the last.
function bodyPts(pts, w0, w1) {
  const left = [], right = [];
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[Math.max(0, i - 1)];
    const [qx, qy] = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(qx - px, qy - py) || 1;
    const nx = -(qy - py) / len, ny = (qx - px) / len;
    const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
  });
  return [...left, ...right.reverse()];
}
const polyOf = (pts) => pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join(' ');

// Rotation (degrees, CSS clockwise) that points an element's "down" from (x1,y1) towards (x2,y2).
const angleDown = (x1, y1, x2, y2) => Math.atan2(-(x2 - x1), y2 - y1) * 180 / Math.PI;

// ---------- art themes: creatures from art, stretched or trailed by the game ----------

function artSVG(art) {
  let out = '';
  DOWNS.forEach(([a, b], i) => {
    const d = wavy(a, b, { amp: 1.4, phase: i });
    out += `<g class="trail down"><path class="t1" d="${d}"/><path class="t2" d="${d}"/></g>`;
  });
  UPS.forEach(([a, b], i) => {
    const style = art.upStyle || 'end';
    if (style === 'end') {
      // three strands hanging from the top end down to the start square
      out += '<g class="trail up">' + [0, 1, 2].map((k) => `<path class="t${k + 1}" d="${wavy(b, a, { amp: 1 + k * 0.5, phase: i + k * 2 })}"/>`).join('') + '</g>';
    } else if (style === 'repeat') {
      out += `<g class="trail up"><path class="t3" d="${wavy(b, a, { amp: 0.8, phase: i })}"/></g>`;
    }
  });
  return out;
}

function spritesHTML(art) {
  const blendOf = (kind) => (kind === 'up' && art.upBlend) || art.blend;
  const end = (n, other, kind) => {
    const { r, c } = squareXY(n);
    const flip = squareXY(other).c > c ? ' flip' : '';
    return `<img class="spr ${kind}${flip}${r === 9 ? ' toprow' : ''} bl-${blendOf(kind)}" src="${art[kind]}" alt="" draggable="false" style="left:${c * 10 + 5}%;top:${(9 - r) * 10 + 5}%">`;
  };
  // head at the top end, tail strip stretched all the way to the far end
  const split = (top, bottom, kind) => {
    const [x1, y1] = centre(top);
    const [x2, y2] = centre(bottom);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const src = art[kind].replace('.png', '');
    return `<div class="stretch ${kind} bl-${blendOf(kind)}" style="left:${f2(x1)}%;top:${f2(y1)}%;height:${f2(len + 3)}%;transform:translateX(-50%) rotate(${f2(angleDown(x1, y1, x2, y2))}deg)">` +
      `<img class="head" src="${src}-head.png" alt="" draggable="false"><img class="tail" src="${src}-tail.png" alt="" draggable="false"></div>`;
  };
  // a chain of copies from the top end down to the start, getting smaller
  const repeat = (top, bottom, kind) => {
    const [x1, y1] = centre(top);
    const [x2, y2] = centre(bottom);
    const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 9) + 1);
    let out = '';
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      out += `<img class="spr rep ${kind} bl-${blendOf(kind)}" src="${art[kind]}" alt="" draggable="false" style="left:${f2(x1 + (x2 - x1) * t)}%;top:${f2(y1 + (y2 - y1) * t)}%;--s:${f2(1 - t * 0.45)}">`;
    }
    return out;
  };
  const downs = DOWNS.map(([a, b]) => end(a, b, 'down')).join('');
  const ups = UPS.map(([a, b]) => {
    const style = art.upStyle || 'end';
    return style === 'split' ? split(b, a, 'up') : style === 'repeat' ? repeat(b, a, 'up') : end(b, a, 'up');
  }).join('');
  return ups + downs;
}

// ---------- classic theme: coloured squares, snakes and ladders, all drawn ----------

const CLASSIC_SQ = ['#e5484d', '#ffffff', '#5c7a10', '#6aa36f', '#e0921d', '#d4b02a'];
// a fixed, random-looking colour for each square, never the same as its left or lower neighbour
const CLASSIC_GRID = (() => {
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const g = [];
  for (let r = 0; r < 10; r++) {
    g.push([]);
    for (let c = 0; c < 10; c++) {
      let k;
      do { k = Math.floor(rnd() * CLASSIC_SQ.length); } while ((c && g[r][c - 1] === k) || (r && g[r - 1][c] === k));
      g[r].push(k);
    }
  }
  return g;
})();

const SNAKES = [
  ['#f08a24', '#4a2206', '#c8461a'],
  ['#b9b13a', '#33320a', '#6f7a17'],
  ['#ef6a3a', '#4a1806', '#f4b23c'],
  ['#f3ece6', '#3e121c', '#8a2b3c'],
];

function snakeSVG(a, b, i) {
  const [body, edge, stripe] = SNAKES[i % SNAKES.length];
  const pts = wavyPts(a, b, { amp: 2.2, phase: i * 1.3, steps: 60 });
  // zig-zag stripe down the middle
  const mid = pts.slice(3, -6);
  const zig = mid.map(([x, y], k) => {
    const [px, py] = mid[Math.max(0, k - 1)];
    const [qx, qy] = mid[Math.min(mid.length - 1, k + 1)];
    const len = Math.hypot(qx - px, qy - py) || 1;
    const w = (1 - k / mid.length) * 0.7 + 0.15;
    const s = k % 2 ? w : -w;
    return [x - (qy - py) / len * s, y + (qx - px) / len * s];
  });
  const [hx, hy] = pts[0];
  const [nx, ny] = pts[4];
  const ang = Math.atan2(hy - ny, hx - nx) * 180 / Math.PI;
  return '<g class="snake">' +
    `<polygon points="${polyOf(bodyPts(pts, 3.2, 0.3))}" fill="${body}" stroke="${edge}" stroke-width=".45" stroke-linejoin="round"/>` +
    `<path d="${pathOf(zig)}" fill="none" stroke="${stripe}" stroke-width=".55"/>` +
    `<g transform="translate(${f2(hx)} ${f2(hy)}) rotate(${f2(ang)})">` +
    '<path d="M2.6 0 L4.2 0 M4.2 0 L5 -.6 M4.2 0 L5 .6" stroke="#c0182b" stroke-width=".3" fill="none" stroke-linecap="round"/>' +
    `<ellipse cx=".4" cy="0" rx="2.6" ry="1.9" fill="${body}" stroke="${edge}" stroke-width=".45"/>` +
    `<circle cx="1.1" cy="-.85" r=".42" fill="${edge}"/><circle cx="1.1" cy=".85" r=".42" fill="${edge}"/>` +
    '</g></g>';
}

function ladderSVG(a, b) {
  const [x1, y1] = centre(a);
  const [x2, y2] = centre(b);
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const nx = -uy * 1.9, ny = ux * 1.9;
  const ext = 2.5; // rails stick out a little past each square's centre
  const sx = x1 - ux * ext, sy = y1 - uy * ext, ex = x2 + ux * ext, ey = y2 + uy * ext;
  let rungs = '';
  for (let d = 1.5; d < len + ext * 2 - 1; d += 3.2) {
    const cx = sx + ux * d, cy = sy + uy * d;
    rungs += `M${f2(cx - nx)},${f2(cy - ny)} L${f2(cx + nx)},${f2(cy + ny)} `;
  }
  return `<g class="ladder"><path d="M${f2(sx + nx)},${f2(sy + ny)} L${f2(ex + nx)},${f2(ey + ny)} M${f2(sx - nx)},${f2(sy - ny)} L${f2(ex - nx)},${f2(ey - ny)}" stroke-width=".9"/><path d="${rungs}" stroke-width=".7"/></g>`;
}

function classicSVG() {
  return UPS.map(([a, b]) => ladderSVG(a, b)).join('') + DOWNS.map(([a, b], i) => snakeSVG(a, b, i)).join('');
}

function boardHTML(view, T) {
  let cells = '';
  for (let row = 9; row >= 0; row--) {
    for (let c = 0; c < 10; c++) {
      const n = row * 10 + (row % 2 === 0 ? c + 1 : 10 - c);
      const kind = BUBBLES[n] ? 'up' : EELS[n] ? 'down' : '';
      const colour = T.classic ? `background:${CLASSIC_SQ[CLASSIC_GRID[row][c]]};` : '';
      cells += `<div class="sq ${kind} ${(row + c) % 2 ? 'alt' : ''}" style="${colour}--depth:${row}"><span>${n === GOAL ? '★' : n}</span></div>`;
    }
  }
  const art = T.classic
    ? `<svg class="art" viewBox="0 0 100 100" aria-hidden="true">${classicSVG()}</svg>`
    : `<svg class="art" viewBox="0 0 100 100" aria-hidden="true">${artSVG(T.art)}</svg><div class="sprs">${spritesHTML(T.art)}</div>`;
  const shown = view.shown;
  const tokens = shown.map((p, seat) => {
    if (!p || !view.state.seats[seat]) return '';
    const { r, c } = squareXY(p);
    const nudge = shown[0] === shown[1] ? (seat === 0 ? -28 : 28) : 0;
    return `<div class="tok t${seat}" style="left:${c * 10}%;top:${(9 - r) * 10}%;--nudge:${nudge}%" title="${esc(nameOf(view, seat))}">${T.tokens[seat]}</div>`;
  }).join('');
  const look = T.classic ? 'classic' : 'has-art';
  const bg = T.art ? ` style="background-image:url('${T.art.bg}')"` : '';
  return `<div class="eb-board ${look}"${bg}><div class="sqs">${cells}</div>${art}${tokens}</div>`;
}

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

const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
function dieHTML(n, rolling) {
  const on = new Set(PIPS[n] || []);
  return `<div class="die ${rolling ? 'rolling' : ''}">${Array.from({ length: 9 }, (_, i) => `<i class="${on.has(i + 1) ? 'p' : ''}"></i>`).join('')}</div>`;
}

function rollText(view, T, x) {
  const who = esc(nameOf(view, x.seat));
  const base = `${T.tokens[x.seat]} ${who} rolled <b>${x.die}</b> → ${x.land}`;
  const them = x.seat === view.mySeat ? 'you' : 'them';
  if (x.via === 'eel') return `${base} — <span class="no">${esc(fill(T.down, them, x.to))}</span>`;
  if (x.via === 'bubble') return `${base} — <span class="yes">${esc(fill(T.up, them, x.to))}</span>`;
  return base;
}

const VARIANT = { classic: '🎲 Classic', pick: '🎲🎲 Pick a die' };
const variantPick = (view) => `<div class="eb-variant" role="group" aria-label="Rules">${Object.keys(VARIANT).map((v) => `<button class="${view.variant === v ? 'on' : ''}" data-variant="${v}">${VARIANT[v]}</button>`).join('')}</div>` +
  `<p class="eb-rule">${view.variant === 'pick' ? 'Pick a die: roll two dice each turn and choose which one to move by.' : 'Classic: roll one die and go where it takes you.'}</p>`;
const fastBtn = (view) => `<button class="ghost fastbtn ${view.fast ? 'on' : ''}" data-act="fast" aria-pressed="${view.fast}" title="Shorter dice and moving animations, just for you">⚡ Fast: ${view.fast ? 'on' : 'off'}</button>`;

// The die and Roll button — or, in Pick a die, the two dice to choose from.
function rollerHTML(view, T, myTurn, last) {
  const s = view.state;
  const o = s.offer;
  if (s.mode === 'pick' && o && s.status === 'playing' && !view.animating) {
    if (o.seat !== view.mySeat) return `<div class="roller">${dieHTML(o.dice[0])}${dieHTML(o.dice[1])}<span class="eb-pickwait">${esc(nameOf(view, o.seat))} is choosing…</span></div>`;
    const choice = (d, i) => {
      const m = moveFrom(s.pos[o.seat], d);
      const where = m.to === GOAL ? '★ the top!' : m.via === 'eel' ? `${m.land} ⬇ ${m.to}` : m.via === 'bubble' ? `${m.land} ⬆ ${m.to}` : `${m.to}`;
      return `<button class="pickdie ${m.via === 'eel' ? 'bad' : m.via === 'bubble' || m.to === GOAL ? 'good' : ''}" data-pick="${i}" ${view.busy ? 'disabled' : ''}>${dieHTML(d)}<span>→ ${where}</span></button>`;
    };
    return `<div class="roller pick"><small>Choose a die:</small>${choice(o.dice[0], 0)}${choice(o.dice[1], 1)}</div>`;
  }
  return `<div class="roller">${dieHTML(view.die ?? last?.die ?? 1, view.rolling)}<button class="big" data-act="roll" ${myTurn && !view.rolling ? '' : 'disabled'}>${s.mode === 'pick' ? '🎲🎲 Roll two' : '🎲 Roll'}</button></div>`;
}

function themeBarHTML(view) {
  const btn = `<button class="ghost themebtn ${view.themeOpen ? 'on' : ''}" data-act="themes">🎨 Theme</button>`;
  if (!view.themeOpen) return btn;
  const chips = THEME_IDS.map((id) => {
    const t = THEMES[id];
    const thumb = t.art ? `<img src="${t.art.bg}" alt="">` : '<span class="classicthumb"></span>';
    return `<button class="themechip ${view.theme === id ? 'on' : ''}" data-theme="${id}">${thumb}<span>${t.icon} ${esc(t.name.join(' & '))}</span></button>`;
  }).join('');
  return `${btn}<div class="themepick">${chips}<small>Only changes how it looks for you.</small></div>`;
}

function lobbyHTML(view, T) {
  const s = view.state;
  let body;
  if (!s) {
    body = (view.bot
      ? `<p>Race the bot — your game with your friend stays just as it is.</p><p>${esc(T.blurb)}</p>`
      : `<p>${esc(T.blurb)}</p>`) + variantPick(view) +
      '<button class="big" data-act="new">Start a game</button>';
  } else if (s.seats[0].uid === view.me.uid) {
    body = '<p>Waiting for your friend to tap <b>Join</b>…</p><button class="ghost" data-act="restart">Start over</button>';
  } else {
    body = `<p><b>${esc(nameOf(view, 0))}</b> wants a race${s.mode === 'pick' ? ' — <b>🎲🎲 Pick a die</b> rules' : ''}.</p><button class="big" data-act="join">Join game</button>`;
  }
  return `<div class="lobby"><h2>${T.icon} ${esc(T.name.join(' & '))}</h2>${body}${scoreLine(view)}<div class="lobbytheme">${themeBarHTML(view)}</div></div>`;
}

function playHTML(view, T) {
  const s = view.state;
  const seat = view.mySeat;
  const playing = seat !== null;
  const over = s.status === 'over' && !view.animating;
  const myTurn = playing && s.status === 'playing' && s.turn === seat && !view.animating;
  const dot = playing && !view.bot ? `<span class="dot ${view.peerOnline ? 'on' : ''}"></span>` : '';
  const other = playing ? 1 - seat : 1;
  const waiting = view.bot ? `${esc(nameOf(view, other))} is rolling…` : `Waiting for ${esc(nameOf(view, other))}…`;
  const choosing = myTurn && s.mode === 'pick' && s.offer;
  const turn = !playing ? 'Watching' : over ? `Game over ${dot}` : view.animating ? 'Moving…' : choosing ? `Your turn — choose a die ${dot}` : myTurn ? `Your turn — roll the ${s.mode === 'pick' ? 'dice' : 'die'} ${dot}` : `${waiting} ${dot}`;
  const last = s.rolls.at(-1);
  let end = '';
  if (over) {
    const won = s.winner === seat;
    end = `<div class="eb-end"><h2>${playing ? (won ? 'You made it to 100! 🏁' : `${esc(nameOf(view, s.winner))} wins`) : `${esc(nameOf(view, s.winner))} wins`}</h2>${scoreLine(view)}${playing ? `<button class="big" data-act="rematch">${view.bot ? 'Play again' : 'Rematch'}</button>` : ''}</div>`;
  }
  const players = [0, 1].map((i) => `<div class="pl ${s.turn === i && s.status === 'playing' ? 'now' : ''}"><span class="pt">${T.tokens[i]}</span>${esc(nameOf(view, i))}<b>${view.shown[i] || 'start'}</b></div>`).join('');
  const waitingDock = view.shown.map((p, i) => (p ? '' : `<span>${T.tokens[i]} ${esc(nameOf(view, i))}</span>`)).join('');
  return `<div class="eb-top">${logo(T)}<div class="eb-topr"><div class="turn ${myTurn ? 'mine' : ''}">${turn}</div>${fastBtn(view)}${themeBarHTML(view)}</div></div>${end}` +
    `<div class="eb-main"><div class="eb-boardcol">${boardHTML(view, T)}<div class="dock">${waitingDock ? `<small>Waiting to start:</small>${waitingDock}` : ''}</div></div>` +
    `<aside class="eb-side"><div class="players">${players}</div>` +
    rollerHTML(view, T, myTurn, last) +
    `<ol class="log">${s.rolls.slice(-40).map((x) => `<li>${rollText(view, T, x)}</li>`).join('')}</ol>` +
    `<div class="foot">${scoreLine(view)}${playing ? '<button class="ghost" data-act="restart">New game</button>' : ''}</div></aside></div>`;
}

function screenHTML(view, T) {
  const banner = view.banner ? `<div class="banner">${esc(view.banner)}</div>` : '';
  if (view.screen === 'loading') return `${logo(T)}<p class="msg">Setting up the board…</p>`;
  if (view.screen === 'message') {
    const btn = view.action === 'new' ? '<button class="big" data-act="new">New game</button>' : view.action === 'retry' ? '<button class="big" data-act="retry">Retry</button>' : '';
    return `${logo(T)}<p class="msg">${esc(view.message)}</p><div class="lobby">${btn}</div>`;
  }
  if (view.screen === 'lobby') return banner + lobbyHTML(view, T);
  return banner + playHTML(view, T);
}

function modeBarHTML(view) {
  if (!view.hasBot) return '';
  return `<nav class="modebar">${['friend', 'bot'].map((m) => `<button class="${view.mode === m ? 'on' : ''}" data-mode="${m}">${m === 'bot' ? '🤖 Vs bot' : '👥 With friend'}</button>`).join('')}</nav>`;
}

export function render(root, view, h) {
  const T = THEMES[view.theme] || THEMES.anglers;
  const html = modeBarHTML(view) + `<div class="eb th-${view.theme} eb-${view.screen}">${screenHTML(view, T)}</div>` +
    (view.confirm ? `<div class="overlay"><div class="endbox"><p style="font-size:18px">${esc(view.confirm.text)}</p><button class="big" data-act="yes">Yes</button><button class="ghost" data-act="no">Cancel</button></div></div>` : '') +
    (view.toast ? `<div class="toast eb-toast">${esc(view.toast)}</div>` : '');
  if (html === lastHTML && root.firstChild) return;
  lastHTML = html;
  root.innerHTML = html;
  const on = (act, fn) => root.querySelectorAll(`[data-act="${act}"]`).forEach((b) => b.addEventListener('click', fn));
  on('new', h.newGame); on('join', h.join); on('roll', h.roll); on('rematch', h.rematch); on('restart', h.restart);
  on('retry', h.retry); on('yes', h.confirmYes); on('no', h.confirmNo); on('themes', h.toggleThemes); on('fast', h.toggleFast);
  root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => h.pick(Number(b.dataset.pick))));
  root.querySelectorAll('[data-variant]').forEach((b) => b.addEventListener('click', () => h.setVariant(b.dataset.variant)));
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => h.setMode(b.dataset.mode)));
  root.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => h.setTheme(b.dataset.theme)));
}
