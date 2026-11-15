// Sharkle — rendering. render(root, view, handlers) rebuilds the game area,
// skipping the DOM write when nothing changed (no lost taps).
import { ROWS, LEN, hasHint, limitOf, answerOf, score, letterHints, solvedIn, boardDone, poolOf, timeOf, fmtTime, wonOnTime, dailyWord, prevDay, liveStreak } from './rules.js';
import { FACTS } from './facts.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOGO = '<h1 class="logo"><span class="f">Shark</span><span class="amp">le</span> <span class="fin">🦈</span></h1>';
const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const MODE_LABEL = { solo: '🐟 Solo', daily: '📅 Daily', friend: '⚔️ VS friend' };

let lastHTML = '';

const POOL_LABEL = { all: '📖 Any word', sea: '🌊 Sea words' };
// Choices for the next game: where the word comes from, and hard mode.
const optionsHTML = (view) => `<div class="wd-opts"><div class="wd-pool" role="group" aria-label="Word pool">${['all', 'sea'].map((p) => `<button class="${view.pool === p ? 'on' : ''}" data-pool="${p}">${POOL_LABEL[p]}</button>`).join('')}</div>` +
  `<button class="wd-hard ${view.hard ? 'on' : ''}" data-act="hard" aria-pressed="${view.hard}" title="Letters you find must be used in later guesses">🔥 Hard mode: ${view.hard ? 'on' : 'off'}</button></div>`;
function tagsHTML(s) {
  if (s.kind === 'daily') {
    const [y, m, d] = s.date.split('-').map(Number);
    const when = new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<span class="wd-tag">📅 ${esc(when)}</span>`;
  }
  return `<span class="wd-tag">${POOL_LABEL[poolOf(s)]}</span>${s.hard ? '<span class="wd-tag hot">🔥 Hard</span>' : ''}`;
}
const factHTML = (answer) => (FACTS[answer] ? `<p class="wd-fact">🌊 ${esc(FACTS[answer])}</p>` : '');
const SHARE_BTN = '<button class="ghost" data-act="share">📤 Share</button>';

function nameOfUid(view, uid, fallback = 'Your friend') {
  if (uid === view.me.uid) return 'You';
  return view.names[uid] || fallback;
}
function nameOf(view, seat) {
  const p = view.state?.seats?.[seat];
  return p ? nameOfUid(view, p.uid, p.name || 'Your friend') : 'Someone';
}

// ---------- the big board ----------

// hint: the position of the revealed letter, or null. A used hint takes the bottom row.
function boardHTML(view, guesses, answer, live, hint = null) {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    let tiles = '';
    let cls = 'wd-row';
    if (hint !== null && r === ROWS - 1) {
      cls += ' hintrow';
      tiles = Array.from({ length: LEN }, (_, i) => (i === hint ? `<div class="tile g">${answer[i]}</div>` : `<div class="tile">${i === (hint === 0 ? 1 : 0) ? '💡' : ''}</div>`)).join('');
    } else if (r < guesses.length) {
      const g = guesses[r];
      const sc = score(g, answer);
      const flip = view.reveal && view.reveal.mode === view.mode && view.reveal.row === r;
      tiles = [...g].map((ch, i) => `<div class="tile ${sc[i]}${flip ? ' flip' : ''}" style="--i:${i}">${ch}</div>`).join('');
    } else if (r === guesses.length && live) {
      const t = view.typed;
      if (view.shake) cls += ' shake';
      tiles = Array.from({ length: LEN }, (_, i) => `<div class="tile ${t[i] ? 'typed' : ''}">${t[i] || ''}</div>`).join('');
    } else {
      tiles = '<div class="tile"></div>'.repeat(LEN);
    }
    rows.push(`<div class="${cls}">${tiles}</div>`);
  }
  return `<div class="wd-board">${rows.join('')}</div>`;
}

function keyboardHTML(view, guesses, answer, live) {
  // keep keyboard colours behind the flip so they don't spoil it
  const shown = view.reveal && view.reveal.mode === view.mode ? guesses.slice(0, view.reveal.row) : guesses;
  const hints = letterHints(shown, answer);
  if (view.my?.hint !== null && view.my?.hint !== undefined) hints[answer[view.my.hint]] = 'g';
  const dis = live && !view.busy ? '' : 'disabled';
  const row = (letters) => [...letters].map((k) => `<button class="key ${hints[k] || ''}" data-key="${k}" ${dis}>${k}</button>`).join('');
  return `<div class="wd-keys">` +
    `<div class="krow">${row(KEYS[0])}</div>` +
    `<div class="krow"><span class="khalf"></span>${row(KEYS[1])}<span class="khalf"></span></div>` +
    `<div class="krow"><button class="key wide" data-key="enter" ${dis}>Enter</button>${row(KEYS[2])}<button class="key wide" data-key="back" aria-label="Delete" ${dis}>⌫</button></div>` +
    `</div>`;
}

// ---------- someone else's board: colours only until letters may be shown ----------

function miniHTML(view, uid, b, answer, showLetters, points) {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const g = b.guesses[r];
    const hintRow = hasHint(b) && r === ROWS - 1;
    const cells = hintRow ? Array.from({ length: LEN }, (_, i) => (i === b.hint ? `<i class="g">${showLetters ? answer[i] : '💡'}</i>` : '<i></i>')).join('')
      : g ? score(g, answer).map((c, i) => `<i class="${c}">${showLetters ? g[i] : ''}</i>`).join('') : '<i></i>'.repeat(LEN);
    rows.push(`<div class="mrow">${cells}</div>`);
  }
  const n = solvedIn(b, answer);
  const t = timeOf(b);
  const status = n !== null ? `Solved in ${n}${hasHint(b) ? ' + 💡' : ''}${t !== null ? ` · ⏱ ${fmtTime(t)}` : ''} 🎯` : b.gaveUp ? 'Gave up 🏳️' : boardDone(b, answer) ? 'Out of guesses' : `${b.guesses.length}/${limitOf(b)} — still hunting…`;
  const online = view.peers.includes(uid);
  return `<div class="wd-opp"><div class="who"><span class="dot ${online ? 'on' : ''}"></span><b>${esc(nameOfUid(view, uid))}</b>${points === null ? '' : `<span class="pts">${points}</span>`}</div>` +
    `<div class="mini">${rows.join('')}</div><small>${status}</small></div>`;
}

// ---------- screens ----------

function statsHTML(st) {
  const pct = st.played ? Math.round((st.wins / st.played) * 100) : 0;
  const max = Math.max(1, ...st.dist);
  const bars = st.dist.map((n, i) => `<div class="bar"><span>${i + 1}</span><div style="width:${Math.max(8, (n / max) * 100)}%">${n}</div></div>`).join('');
  return `<div class="wd-stats"><div class="nums">` +
    `<div><b>${st.played}</b><small>Played</small></div><div><b>${pct}</b><small>Win %</small></div>` +
    `<div><b>${st.streak}</b><small>Streak</small></div><div><b>${st.best}</b><small>Best</small></div></div>` +
    `<h3>Guess spread</h3><div class="dist">${bars}</div></div>`;
}

// Your daily streak and the last seven days (today on the right).
function streakHTML(view) {
  const st = view.dstats;
  const byDay = new Map((st?.hist || []).map((h) => [h.d, h.n]));
  const days = [];
  let d = view.today;
  for (let i = 0; i < 7; i++) { days.unshift(d); d = prevDay(d); }
  const week = days.map((day) => {
    const n = byDay.get(day);
    const label = `<small>${Number(day.slice(8))}</small>`;
    return n === undefined ? `<i title="${day}: not played">·${label}</i>` : `<i class="${n ? 'w' : 'l'}" title="${day}">${n || 'X'}${label}</i>`;
  }).join('');
  const pct = st?.played ? Math.round((st.wins / st.played) * 100) : 0;
  return `<div class="wd-streak"><span>🔥 Streak <b>${liveStreak(st, view.today)}</b></span><span>Best <b>${st?.best || 0}</b></span><span>Played <b>${st?.played || 0}</b></span><span>Won <b>${pct}%</b></span></div><div class="wd-week">${week}</div>`;
}

function lobbyHTML(view) {
  const s = view.state;
  const hero = '<div class="wd-hero"><div class="tile g">S</div><div class="tile y">H</div><div class="tile b">A</div><div class="tile g">R</div><div class="tile y">K</div></div>';
  let body;
  if (view.mode === 'solo') {
    body = `<p>Guess the secret word in six tries.<br><b class="g">Teal</b> = right spot, <b class="y">gold</b> = wrong spot.</p>${optionsHTML(view)}<button class="big" data-act="new">Start</button>`;
  } else if (!s) {
    body = `<p>Race your friend on the same secret word.<br>Fewest guesses wins; a tie goes to the faster solver. You see their colours, never their letters.</p>${optionsHTML(view)}<button class="big" data-act="new">Start a race</button>`;
  } else if (s.seats[0].uid === view.me.uid) {
    body = `<p>Waiting for your friend to tap <b>Join</b>…</p><p>${tagsHTML(s)}</p><button class="ghost" data-act="new">Start over</button>`;
  } else {
    body = `<p><b>${esc(nameOf(view, 0))}</b> challenges you to a word race.</p><p>${tagsHTML(s)}</p><button class="big" data-act="join">Join race</button>`;
  }
  const sc = s?.kind === 'vs' && s.seats[1] ? `<div class="score">${esc(nameOf(view, 0))} <b>${s.score[s.seats[0].uid] || 0}</b> – <b>${s.score[s.seats[1].uid] || 0}</b> ${esc(nameOf(view, 1))}</div>` : '';
  return `<div class="lobby">${hero}<h2>🦈 Sharkle</h2>${body}${sc}</div>`;
}

function playHTML(view) {
  const s = view.state;
  const my = view.my;
  const answer = answerOf(s);
  const WORD = answer.toUpperCase();
  let guesses = my.guesses; let live = my.live; let pill; let side = ''; let end = ''; let foot = ''; let acts = '';
  const limit = ROWS - (my.hint !== null && my.hint !== undefined ? 1 : 0);
  const guessPill = `Guess ${Math.min(guesses.length + 1, limit)} of ${limit}`;
  const GIVEUP = `${my.canHint ? '<button class="wd-giveup" data-act="hint" title="Show one letter. Costs one of your six guesses.">💡 Hint</button>' : ''}<button class="wd-giveup" data-act="giveup">🏳️ Give up</button>`;

  if (s.kind === 'solo') {
    pill = my.done ? (s.won ? `Solved in ${guesses.length}! 🎯` : `It was <b>${WORD}</b>`) : guessPill;
    acts = live ? `${GIVEUP}<button class="wd-giveup" data-act="new">🔄 New word</button>` : '';
    foot = my.done
      ? `<button class="big" data-act="new">New word</button><button class="ghost" data-act="stats">📊 Stats</button>${SHARE_BTN}${optionsHTML(view)}`
      : '<button class="ghost" data-act="stats">📊 Stats</button>';
    if (my.done) end = factHTML(answer) ? `<div class="wd-end slim">${factHTML(answer)}</div>` : '';
  } else if (s.kind === 'daily') {
    const b = my.board;
    const n = solvedIn(b, answer);
    const t = timeOf(b);
    pill = my.done ? (n !== null ? `Solved in ${n}! 🎯` : `It was <b>${WORD}</b>`) : guessPill;
    acts = live ? GIVEUP : '';
    const others = Object.keys(s.boards).filter((u) => u !== view.me.uid && s.boards[u].guesses.length + (s.boards[u].gaveUp ? 1 : 0) > 0);
    side = `<aside class="wd-side"><h3>Today’s boards</h3>${others.length
      ? others.map((u) => miniHTML(view, u, s.boards[u], answer, my.done, null)).join('')
      : '<p class="wd-quiet">Nobody else has played today yet.</p>'}${others.length && !my.done ? '<p class="wd-quiet">Letters show once you finish.</p>' : ''}` +
      `<p class="wd-quiet">🔥 Your streak: <b>${liveStreak(view.dstats, view.today)}</b></p><p class="wd-quiet">Yesterday’s word: <b>${dailyWord(prevDay(s.date)).toUpperCase()}</b></p></aside>`;
    if (my.done) {
      end = `<div class="wd-end"><h2>${n !== null ? `Solved in ${n}${t !== null ? ` · ⏱ ${fmtTime(t)}` : ''} 🎯` : 'The shark got this one 🦈'}</h2>` +
        `<p>Today’s word was <b>${WORD}</b></p>${factHTML(answer)}${streakHTML(view)}${SHARE_BTN}<p class="wd-quiet">A new word arrives at midnight.</p></div>`;
    }
  } else {
    const seat = view.mySeat;
    const playing = seat !== null;
    const over = s.status === 'over';
    if (!playing) { guesses = s.boards[s.seats[0].uid].guesses; live = false; }
    const mine = playing ? s.boards[view.me.uid] : null;
    const n = mine ? solvedIn(mine, answer) : null;
    const done = mine ? boardDone(mine, answer) : false;
    pill = !playing ? 'Watching' : over ? 'Race over'
      : done ? (n !== null ? `Solved in ${n}! Waiting on ${esc(nameOf(view, 1 - seat))}…` : `Waiting on ${esc(nameOf(view, 1 - seat))}…`)
      : guessPill;
    acts = live ? `${GIVEUP}<button class="wd-giveup" data-act="new">🔄 New race</button>` : '';
    if (playing) {
      const opp = s.seats[1 - seat].uid;
      side = `<aside class="wd-side">${miniHTML(view, opp, s.boards[opp], answer, over, s.score[opp] || 0)}</aside>`;
    }
    if (over && playing) {
      const title = s.winner === 'draw' ? 'Dead heat! 🤝' : s.winner === seat ? 'You win! 🏆' : `${esc(nameOf(view, s.winner))} wins 🦈`;
      const t = timeOf(mine);
      const how = wonOnTime(s) ? '<p>Same number of guesses — decided on the clock ⏱</p>' : '';
      end = `<div class="wd-end"><h2>${title}</h2>${how}<p>The word was <b>${WORD}</b>${n !== null && t !== null ? ` · you: ${n} guesses in ${fmtTime(t)}` : ''}</p>${factHTML(answer)}` +
        `<button class="big" data-act="rematch">Rematch</button>${SHARE_BTN}</div>`;
    }
    foot = playing && !live ? `<button class="ghost" data-act="new">New race</button>${over ? optionsHTML(view) : ''}` : '';
  }

  const banner = view.banner ? `<div class="banner">${esc(view.banner)}</div>` : '';
  return `${banner}<div class="wd-top">${LOGO}<span class="wd-tags">${tagsHTML(s)}</span><div class="wd-topr">${acts}<div class="turn ${live ? 'mine' : ''}">${pill}</div></div></div>${end}` +
    `<div class="wd-main ${side ? 'has-side' : ''}"><div class="wd-col">${boardHTML(view, guesses, answer, live, view.mySeat === null && s.kind === 'vs' ? null : my.hint ?? null)}${keyboardHTML(view, guesses, answer, live)}<div class="wd-foot">${foot}</div></div>${side}</div>`;
}

function screenHTML(view) {
  if (view.screen === 'loading') return `${LOGO}<p class="msg">Chumming the water…</p>`;
  if (view.screen === 'message') {
    const btn = view.action === 'new' && view.mode !== 'daily' ? '<button class="big" data-act="new">New game</button>' : view.action === 'retry' ? '<button class="big" data-act="retry">Retry</button>' : '';
    return `${LOGO}<p class="msg">${esc(view.message)}</p><div class="lobby">${btn}</div>`;
  }
  if (view.screen === 'lobby') return lobbyHTML(view);
  return playHTML(view);
}

function modeBarHTML(view) {
  if (view.modes.length < 2) return '';
  return `<nav class="modebar">${view.modes.map((m) => `<button class="${view.mode === m ? 'on' : ''}" data-mode="${m}">${MODE_LABEL[m]}</button>`).join('')}</nav>`;
}

function overlayHTML(view) {
  if (view.confirm) return `<div class="overlay"><div class="endbox"><p style="font-size:18px">${esc(view.confirm.text)}</p><button class="big" data-act="yes">Yes</button><button class="ghost" data-act="no">Cancel</button></div></div>`;
  if (view.shareBox) return `<div class="overlay" data-act="closeshare"><div class="endbox" data-stop><p>Copy this and send it to your friend:</p><textarea class="wd-sharebox" readonly rows="8">${esc(view.shareBox)}</textarea><button class="ghost" data-act="closeshare">Close</button></div></div>`;
  const s = view.state;
  if (view.showStats && view.mode === 'solo' && s?.kind === 'solo') {
    const over = s.status === 'over';
    const answer = answerOf(s);
    return `<div class="overlay" data-act="stats"><div class="endbox wd-statbox" data-stop>` +
      `<h2>${over ? (s.won ? 'Got it! 🎯' : `It was ${answer.toUpperCase()}`) : 'Your stats'}</h2>${over ? factHTML(answer) : ''}${statsHTML(s.stats)}` +
      `${over ? `<button class="big" data-act="new">Next word</button>${SHARE_BTN}` : ''}<button class="ghost" data-act="stats">Close</button></div></div>`;
  }
  return '';
}

export function render(root, view, h) {
  const html = modeBarHTML(view) + `<div class="wd wd-${view.screen}">${screenHTML(view)}</div>` + overlayHTML(view) +
    (view.toast ? `<div class="toast wd-toast">${esc(view.toast)}</div>` : '');
  if (html === lastHTML && root.firstChild) return;
  lastHTML = html;
  root.innerHTML = html;
  const on = (act, fn) => root.querySelectorAll(`[data-act="${act}"]`).forEach((b) => b.addEventListener('click', (e) => {
    if (b.classList.contains('overlay') && e.target.closest('[data-stop]')) return; // clicks inside the box
    fn();
  }));
  on('new', h.newGame); on('join', h.join); on('rematch', h.rematch); on('giveup', h.giveUp);
  on('stats', h.toggleStats); on('retry', h.retry); on('yes', h.confirmYes); on('no', h.confirmNo);
  on('hard', h.toggleHard); on('share', h.share); on('closeshare', h.closeShare); on('hint', h.hint);
  root.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => { h.key(b.dataset.key); b.blur(); }));
  root.querySelectorAll('[data-pool]').forEach((b) => b.addEventListener('click', () => h.setPool(b.dataset.pool)));
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => h.setMode(b.dataset.mode)));
}
