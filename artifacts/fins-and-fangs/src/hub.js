// The strip under the tabs, shared by every game: the running score against
// your friend, whose turn it is where, trophies, match history, how to play,
// quick reactions and the sound switch. It reads the games' saves but never
// writes to them; its own saves are reactions, trophies and history.
import { play, isMuted, setMuted } from './shared/sound.js';
import { TROPHIES, TROPHY, onAward, HISTORY_MAX } from './shared/trophies.js';
import { HELP } from './help.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const EMOTES = ['🦈', '😂', '😱', '👏', '😭', '🔥', '🤔', '👋'];
const isBotUid = (uid) => /^bot:/.test(uid || '');

export function validateReaction(raw) {
  const r = raw;
  if (!r || typeof r !== 'object' || r.v !== 1 || typeof r.from !== 'string' || !EMOTES.includes(r.emoji) || !Number.isFinite(r.n)) return null;
  return r;
}

// Your score and your friend's in one game's save, or null if you aren't playing a person there.
export function scoreIn(s, uid) {
  if (!s || !Array.isArray(s.seats) || !s.seats[0] || !s.seats[1] || !s.score) return null;
  const i = s.seats.findIndex((p) => p.uid === uid);
  if (i < 0) return null;
  const opp = s.seats[1 - i];
  if (isBotUid(opp.uid)) return null;
  return { me: s.score[uid] || 0, them: s.score[opp.uid] || 0, opp: opp.uid };
}

// How a finished game went for this player: 'win' | 'lose' | 'draw' | null (not theirs).
export function resultFor(s, uid) {
  if (!s || s.status !== 'over') return null;
  if (s.kind === 'solo') return s.won ? 'win' : 'lose';
  if (!Array.isArray(s.seats)) return null;
  const i = s.seats.findIndex((p) => p && p.uid === uid);
  if (i < 0) return null;
  if (s.winner === 'draw' || s.winner === null || s.winner === undefined) return 'draw';
  return s.winner === i ? 'win' : 'lose';
}

// Trophies a game that just ended in a win has earned for this player.
export function trophiesFor(gameId, s, uid) {
  const out = [];
  if (resultFor(s, uid) !== 'win') return out;
  if (s.kind === 'solo') {
    if (s.guesses.length <= 2) out.push('sharpteeth');
    if (s.hard) out.push('thickskin');
    return out;
  }
  const me = s.seats.findIndex((p) => p.uid === uid);
  const opp = s.seats[1 - me].uid;
  const realFight = !isBotUid(opp) || opp === 'bot:medium' || opp === 'bot:hard';
  if (opp === 'bot:hard') out.push('hardbot');
  if (gameId === 'wordle' && s.hard) out.push('thickskin');
  if (gameId === 'fins' && s.series && (s.score[uid] || 0) - (s.series.base[uid] || 0) >= s.series.to) out.push('series');
  if (gameId === 'hooked') { const mine = s.casts.filter((x) => x.seat === me); if (mine.length && mine.filter((x) => x.hit).length * 2 >= mine.length) out.push('sharpshooter'); }
  if (gameId === 'ttt' && s.mode === 'three' && realFight) out.push('vanish');
  if (gameId === 'eels' && s.rolls.filter((x) => x.seat === me && x.via === 'eel').length >= 3) out.push('slippery');
  if (gameId === 'drop' && realFight) out.push('frenzy');
  if (gameId === 'memory' && (s.owner.filter((o) => o === me).length - s.owner.filter((o) => o === 1 - me).length) / 2 >= 3) out.push('elephant');
  return out;
}

export async function mountHub(el, entries, { show, getActive, openDoc, title = 'Fins & Fangs' }) {
  const hub = {
    me: null, scores: {}, turns: {}, names: {}, tray: false, last: {}, sendAt: 0, panel: null,
    collapsed: false, got: null, history: null,
  };
  try {
    const saved = localStorage.getItem('games:hub');
    hub.collapsed = saved ? saved === 'closed' : innerWidth < 600; // phones start with the strip folded away
  } catch { /* optional */ }
  const any = entries.map((e) => e.store || e.botStore).find(Boolean);
  if (any) { try { hub.me = await any.me(); } catch { /* signed out */ } }
  const uid = hub.me?.uid || '';
  const byId = Object.fromEntries(entries.map((e) => [e.g.id, e.g]));
  let reactions = null, trophies = null, history = null;
  let baseline; // the reaction already saved when the page opened is old news
  const who = (u) => (u === uid ? 'You' : hub.names[u] || 'Friend');
  async function learn(store, uids) {
    const need = uids.filter((u) => u && u !== uid && !(u in hub.names) && !isBotUid(u));
    if (!need.length) return;
    for (const u of need) hub.names[u] = '';
    try { Object.assign(hub.names, await store.names(need)); } catch { /* keep "Friend" */ }
    draw();
  }

  // ---------- drawing ----------

  function panelHTML() {
    const box = (title2, body) => `<div class="overlay hub-overlay" data-act="close"><div class="endbox hub-panel" data-stop><h2>${title2}</h2>${body}<button class="ghost" data-act="close">Close</button></div></div>`;
    if (hub.panel === 'help') {
      const h = HELP[getActive()] || HELP.fins;
      return box(`How to play ${h.title}`, `<ul class="hub-help">${h.lines.map((l) => `<li>${l}</li>`).join('')}</ul>`);
    }
    if (hub.panel === 'trophies') {
      const got = hub.got || {};
      const rows = TROPHIES.map((t) => `<li class="${got[t.id] ? 'got' : ''}"><span>${got[t.id] ? t.icon : '🔒'}</span><div><b>${esc(t.name)}</b><small>${esc(t.how)}</small></div></li>`).join('');
      return box(`🏅 Trophies ${Object.keys(got).length}/${TROPHIES.length}`, `<ul class="hub-trophies">${rows}</ul>`);
    }
    if (hub.panel === 'history') {
      const items = (hub.history?.items || []).slice().reverse();
      const rows = items.map((x) => {
        const g = byId[x.g];
        const result = x.w === 'draw' ? 'Draw' : x.w === uid ? '<b class="w">You won</b>' : `<b class="l">${esc(who(x.w))} won</b>`;
        const when = new Date(x.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `<li><span>${g ? g.icon : '🎲'}</span><div>${esc(g ? g.name : x.g)}<small>${when}</small></div><em>${result}</em></li>`;
      }).join('');
      return box('📜 Match history', items.length ? `<ul class="hub-history">${rows}</ul>` : '<p>No finished games yet. Games you finish against your friend from now on will be listed here.</p>');
    }
    return '';
  }

  function draw() {
    const rows = entries.map((e) => ({ e, sc: hub.scores[e.g.id] })).filter((x) => x.sc);
    const mine = rows.reduce((n, x) => n + x.sc.me, 0);
    const theirs = rows.reduce((n, x) => n + x.sc.them, 0);
    const friend = who(rows[0]?.sc.opp);
    const waiting = entries.filter((e) => hub.turns[e.g.id]);
    const fold = `<button class="hub-btn hub-fold" data-act="fold" title="${hub.collapsed ? 'Show scores and tools' : 'Hide this strip'}" aria-expanded="${!hub.collapsed}">${hub.collapsed ? '▸' : '▾'}</button>`;
    const total = rows.length ? `<span class="hub-total" title="Wins across every game">🏆 You <b>${mine}</b> – <b>${theirs}</b> ${esc(friend)}</span>` : '';
    if (hub.collapsed) {
      const turnBadge = waiting.length ? `<span class="hub-turns">Your turn: ${waiting.map((e) => `<button class="hub-link" data-go="${e.g.id}" title="${esc(e.g.name)}">${e.g.icon}</button>`).join(' ')}</span>` : '';
      el.innerHTML = `<div class="hub-row closed">${fold}${total}${turnBadge}</div>${panelHTML()}`;
    } else {
      const chips = rows.map(({ e, sc }) => `<button class="hub-chip ${hub.turns[e.g.id] ? 'turn' : ''}" data-go="${e.g.id}" title="${esc(e.g.name)}${hub.turns[e.g.id] ? ' — your turn' : ''}">${e.g.icon} ${sc.me}–${sc.them}</button>`).join('');
      const turnNote = waiting.length ? `<span class="hub-turns">Your turn: ${waiting.map((e) => `<button class="hub-link" data-go="${e.g.id}">${e.g.icon} ${esc(e.g.name)}</button>`).join(' ')}</span>` : '';
      const tray = hub.tray ? `<div class="hub-tray">${EMOTES.map((m) => `<button data-emote="${m}" aria-label="Send ${m}">${m}</button>`).join('')}</div>` : '';
      const nGot = Object.keys(hub.got || {}).length;
      el.innerHTML = `<div class="hub-row">${fold}${total}${chips}${turnNote}<span class="hub-tools">` +
        (trophies ? `<button class="hub-btn" data-act="trophies" title="Trophies">🏅 ${nGot}/${TROPHIES.length}</button>` : '') +
        (history ? '<button class="hub-btn" data-act="history" title="Match history">📜</button>' : '') +
        '<button class="hub-btn" data-act="help" title="How to play this game">❓</button>' +
        (reactions ? `<button class="hub-btn ${hub.tray ? 'on' : ''}" data-act="react" title="Send your friend a reaction">😀 React</button>` : '') +
        `<button class="hub-btn" data-act="mute" title="Sound on or off" aria-pressed="${!isMuted()}">${isMuted() ? '🔇' : '🔊'}</button></span></div>${tray}${panelHTML()}`;
    }
    el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
    const on = (act, fn) => el.querySelectorAll(`[data-act="${act}"]`).forEach((b) => b.addEventListener('click', (ev) => {
      if (b.classList.contains('overlay') && ev.target.closest('[data-stop]') && !ev.target.closest('[data-act="close"]:not(.overlay)')) return;
      fn();
    }));
    on('fold', () => { hub.collapsed = !hub.collapsed; hub.tray = false; try { localStorage.setItem('games:hub', hub.collapsed ? 'closed' : 'open'); } catch { /* optional */ } draw(); });
    on('mute', () => { setMuted(!isMuted()); draw(); });
    on('react', () => { hub.tray = !hub.tray; draw(); });
    for (const p of ['help', 'trophies', 'history']) on(p, () => { hub.panel = p; hub.tray = false; draw(); });
    on('close', () => { hub.panel = null; draw(); });
    el.querySelectorAll('[data-emote]').forEach((b) => b.addEventListener('click', () => send(b.dataset.emote)));
    try { document.title = waiting.length ? `(${waiting.length}) ${title}` : title; } catch { /* optional */ }
  }

  // big pop-ups (reactions, new trophies) take turns so they don't pile up
  const pops = [];
  let popping = false;
  function pop(emoji, label, cls = '') {
    if (typeof document === 'undefined') return;
    pops.push([emoji, label, cls]);
    if (popping) return;
    popping = true;
    const next = () => {
      const p = pops.shift();
      if (!p) { popping = false; return; }
      const n = document.createElement('div');
      n.className = `hub-pop ${p[2]}`;
      n.innerHTML = `<span>${p[0]}</span>${p[1] ? `<small>${esc(p[1])}</small>` : ''}`;
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 2600);
      setTimeout(next, 1500);
    };
    next();
  }

  async function send(emoji) {
    if (!reactions || !uid || Date.now() - hub.sendAt < 1200) return;
    hub.sendAt = Date.now();
    hub.tray = false;
    draw();
    pop(emoji, 'You');
    try { await reactions.write({ v: 1, from: uid, emoji, n: Date.now() }, null); } catch { /* it's only a reaction */ }
  }

  // ---------- trophies ----------

  const pending = new Set();
  async function give(id) {
    if (!trophies || !TROPHY[id] || pending.has(id)) return;
    if (hub.got === null) { setTimeout(() => give(id), 1500); return; } // not loaded yet
    if (hub.got[id]) return;
    pending.add(id);
    let ok = false;
    try {
      ok = await trophies.write(null, null, undefined, { orCreate: true, apply: (c) => (c?.got?.[id] ? null : { v: 1, kind: 'trophies', got: { ...(c?.got || {}), [id]: Date.now() } }) });
    } catch { ok = false; }
    pending.delete(id);
    if (ok) { hub.got = { ...hub.got, [id]: Date.now() }; pop(TROPHY[id].icon, `Trophy: ${TROPHY[id].name}`, 'trophy'); play('win'); draw(); }
  }

  // trophies that depend on the running totals
  function checkTotals() {
    const rows = entries.map((e) => hub.scores[e.g.id]).filter(Boolean);
    const mine = rows.reduce((n, x) => n + x.me, 0);
    if (mine >= 1) give('first_win');
    if (mine >= 10) give('wins10');
    if (mine >= 25) give('wins25');
    if (entries.filter((e) => (hub.scores[e.g.id]?.me || 0) >= 1).length >= 7) give('allround');
  }

  // ---------- watching the games ----------

  async function logGame(g, s) {
    if (!history || !Array.isArray(s.seats) || !s.seats[0] || !s.seats[1] || s.seats.some((p) => isBotUid(p.uid))) return;
    const k = `${g.id}:${s.round ?? 0}:${s.turnNo ?? 0}`;
    const w = s.winner === 0 || s.winner === 1 ? s.seats[s.winner].uid : 'draw';
    const item = { k, g: g.id, p: s.seats.map((p) => p.uid), w, t: Date.now() };
    try {
      await history.write(null, null, undefined, { orCreate: true, apply: (c) => {
        const items = c?.items || [];
        return items.some((x) => x.k === k) ? null : { v: 1, kind: 'history', items: [...items, item].slice(-HISTORY_MAX) };
      } });
    } catch { /* the list is a nicety */ }
  }

  // sounds, trophies and the history entry for one game's save
  function watch(key, g, s, friendGame) {
    const sig = s ? `${s.round ?? ''}|${s.turnNo ?? s.guesses?.length ?? ''}|${s.status ?? ''}` : '';
    const was = hub.last[key];
    hub.last[key] = sig;
    if (was === undefined || was === sig || !s) return; // first load, or nothing changed
    const res = resultFor(s, uid);
    const justEnded = s.status === 'over' && !was.endsWith('|over');
    if (res && justEnded) {
      play(res);
      for (const id of trophiesFor(g.id, s, uid)) give(id);
    } else if (!res) play('move');
    if (friendGame && justEnded) logGame(g, s);
  }

  for (const e of entries) {
    e.store?.subscribe((s, err) => {
      if (err) return;
      watch(`f:${e.g.id}`, e.g, s, true);
      const sc = scoreIn(s, uid);
      const before = JSON.stringify(hub.scores[e.g.id] || null);
      if (sc) hub.scores[e.g.id] = sc; else delete hub.scores[e.g.id];
      if (JSON.stringify(sc) !== before) { draw(); checkTotals(); }
      if (sc) learn(e.store, [sc.opp]);
    });
    e.botStore?.subscribe((s, err) => { if (!err) watch(`b:${e.g.id}`, e.g, s, false); });
  }

  draw();
  if (uid) {
    const open = (path, key, validate) => openDoc(path, key, validate).catch(() => null);
    [reactions, trophies, history] = await Promise.all([
      open('reactions/current', 'games:reaction', validateReaction),
      open(`trophies/${uid}`, `games:trophies:${uid}`, null),
      open('history/current', 'games:history', null),
    ]);
  }
  reactions?.subscribe(async (r, err) => {
    if (err) return;
    const n = r?.n ?? 0;
    if (baseline === undefined) { baseline = n; return; }
    if (!r || n === baseline) return;
    baseline = n;
    if (r.from === uid) return;
    await learn(reactions, [r.from]);
    pop(r.emoji, hub.names[r.from] || 'Your friend');
    play('react');
  });
  trophies?.subscribe((t, err) => {
    if (err === 'lost' || err === 'broken') return;
    hub.got = { ...(t?.got || {}), ...(hub.got || {}) };
    draw();
    checkTotals();
  });
  history?.subscribe((h, err) => {
    if (err) return;
    hub.history = h;
    if (h) learn(history, [...new Set(h.items.flatMap((x) => x.p))]);
    if (hub.panel === 'history') draw();
  });
  onAward(give);
  draw();

  return {
    setTurn(id, mine) {
      const now = Boolean(mine);
      if (Boolean(hub.turns[id]) === now) return;
      hub.turns[id] = now;
      if (now) play('turn');
      draw();
    },
    refresh: draw,
  };
}
