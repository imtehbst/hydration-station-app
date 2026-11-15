// Sharkle — wiring: store <-> rules <-> ui. Mounted by the games shell.
// Three games side by side:
//   'solo'   your own words, saved per person (the shell's botStore)
//   'daily'  one word a day for everyone, one shared save per date (ctx.openStore)
//   'friend' a race on the same word (the shell's shared store)
import {
  LEN, POOLS, answerOf, checkGuess, hardProblem, newSolo, soloGuess, soloGiveUp,
  createVs, joinVs, seatOf, vsGuess, vsGiveUp, vsRematch, needsMe, solvedIn, boardDone, timeOf,
  dateKey, newDaily, dailyBoard, dailyGuess, dailyGiveUp, shareText, recordDaily, liveStreak,
  hasHint, canHint, hintChoices, soloHint, vsHint, dailyHint, costOf,
} from './rules.js';
import { render } from './ui.js';
import { playFx } from './fx.js';
import { award } from '../shared/trophies.js';

let root = null;
let onTurnChange = () => {};
let openStore = null;
let modeKey = '';

const MODES = ['solo', 'daily', 'friend'];
const newSlot = () => ({ store: null, state: null, err: null, loaded: false, unsub: null, typed: '' });
const slots = { solo: newSlot(), daily: newSlot(), friend: newSlot() };

const app = {
  mode: 'solo', me: { uid: '', name: '' }, peers: [], names: {}, toast: '', ask: null, busy: false,
  reveal: null, shake: false, seenKey: '', showStats: false, pool: 'all', hard: false, today: dateKey(), shareBox: '', dstats: null,
};
// your own daily record: streak and recent days (one save per person)
const record = { store: null, loaded: false, busy: false };

const cur = () => slots[app.mode];
// The daily save doesn't exist until somebody guesses; an empty one stands in.
const stateOf = (mode) => (mode === 'daily' && slots.daily.loaded && !slots.daily.state ? newDaily(app.today) : slots[mode].state);

// My side of a game: my guesses, whether I can still guess, and whether I'm finished.
function mine(s) {
  if (!s) return { guesses: [], live: false, done: false };
  const answer = answerOf(s);
  if (s.kind === 'solo') return { guesses: s.guesses, live: s.status === 'playing', done: s.status === 'over', solved: s.won, hint: hasHint(s) ? s.hint : null, canHint: s.status === 'playing' && canHint(s) };
  const b = s.kind === 'daily' ? dailyBoard(s, app.me.uid) : s.boards[app.me.uid];
  if (!b) return { guesses: [], live: false, done: false };
  const done = boardDone(b, answer);
  const playing = s.kind === 'daily' || s.status === 'playing';
  return { guesses: b.guesses, live: playing && !done, done: s.kind === 'daily' ? done : s.status === 'over', solved: solvedIn(b, answer) !== null, board: b, hint: hasHint(b) ? b.hint : null, canHint: playing && !done && canHint(b) };
}
const gameKey = (s) => (!s ? '' : s.kind === 'daily' ? `daily|${s.date}` : `${s.kind}|${s.round}|${s.w}`);
const phaseOf = (s) => (!s ? '' : s.kind === 'daily' ? (mine(s).done ? 'over' : 'playing') : s.status);

function view() {
  const sl = cur();
  const base = {
    mode: app.mode, modes: MODES.filter((m) => slots[m].store), me: app.me, names: app.names, toast: app.toast, confirm: app.ask, busy: app.busy,
    typed: sl.typed, reveal: app.reveal, shake: app.shake, showStats: app.showStats, peers: app.peers,
    pool: app.pool, hard: app.hard, shareBox: app.shareBox, dstats: app.dstats, today: app.today,
  };
  if (!sl.store) return { ...base, screen: 'message', message: sl.loaded ? 'Sign in to play — this page can’t save games here.' : 'Chumming the water…' };
  if (sl.err === 'broken') return { ...base, screen: 'message', message: 'Game data looks broken — start a new game.', action: 'new' };
  if (sl.err === 'timeout' && !sl.state) return { ...base, screen: 'message', message: 'Still connecting…', action: 'retry' };
  if (!sl.loaded) return { ...base, screen: 'loading' };
  const s = stateOf(app.mode);
  const common = { ...base, state: s, my: mine(s), banner: sl.err === 'timeout' ? 'Reconnecting…' : '', mySeat: seatOf(s, app.me.uid) };
  if (!s || (s.kind === 'vs' && s.status === 'waiting')) return { ...common, screen: 'lobby' };
  return { ...common, screen: 'play' };
}

const draw = () => root && render(root, view(), handlers);

let toastTimer;
function toast(msg, ms = 2600) {
  app.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { app.toast = ''; draw(); }, ms);
  draw();
}

let shakeTimer;
function shake(msg) {
  app.shake = true;
  clearTimeout(shakeTimer);
  shakeTimer = setTimeout(() => { app.shake = false; draw(); }, 500);
  toast(msg, 1800);
}

async function write(store, next, opts = {}) {
  if (app.busy) return false;
  app.busy = true;
  draw();
  try {
    const ok = await store.write(next, null, undefined, opts);
    if (!ok && !opts.quiet) toast('That didn’t go through — the game moved on. Try again.');
    return ok;
  } catch {
    toast('Couldn’t save that. Check your connection and try again.');
    return false;
  } finally {
    app.busy = false;
    draw();
  }
}

function askFirst(text, onYes) { app.ask = { text, onYes }; draw(); }
const canType = () => !app.busy && !app.ask && !app.shareBox && mine(stateOf(app.mode)).live;
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* optional */ } };

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* try the old way */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

const handlers = {
  setMode(mode) {
    if (mode === app.mode || !slots[mode].store) return;
    app.mode = mode; app.ask = null; app.reveal = null; app.showStats = false; app.shareBox = '';
    save(modeKey, mode);
    const s = stateOf(mode);
    app.seenKey = `${mode}|${gameKey(s)}|${phaseOf(s)}`;
    draw();
  },
  key(k) {
    if (!canType()) return;
    const sl = cur();
    if (k === 'enter') return handlers.submit();
    if (k === 'back') sl.typed = sl.typed.slice(0, -1);
    else if (/^[a-z]$/.test(k) && sl.typed.length < LEN) sl.typed += k;
    draw();
  },
  async submit() {
    const sl = cur();
    const mode = app.mode;
    const s = stateOf(mode);
    const word = sl.typed;
    const { guesses } = mine(s);
    const bad = checkGuess(word);
    if (bad === 'short') return shake('Five letters, please 🐟');
    if (bad === 'unknown') return shake('Not in the word list');
    if (guesses.includes(word)) return shake('You already tried that one');
    const hard = s.hard ? hardProblem(guesses, answerOf(s), word) : null;
    if (hard) return shake(`🔥 ${hard}`);
    const key = gameKey(s);
    const n = guesses.length;
    const uid = app.me.uid;
    let opts;
    if (s.kind === 'solo') opts = { apply: (c) => (gameKey(c) === key && c.status === 'playing' && c.guesses.length === n ? soloGuess(c, word) : null) };
    else if (s.kind === 'vs') opts = { apply: (c) => (gameKey(c) === key && c.status === 'playing' && (c.boards[uid]?.guesses.length ?? -1) === n ? vsGuess(c, uid, word) : null) };
    else opts = { orCreate: true, apply: (c) => { const d = c || newDaily(s.date); return d.date === s.date && dailyBoard(d, uid).guesses.length === n ? dailyGuess(d, uid, word) : null; } };
    const ok = await write(sl.store, null, opts);
    if (ok) { sl.typed = ''; startReveal(mode, n); }
  },
  newGame() {
    const s = cur().state;
    if (app.mode === 'daily') return;
    if (app.mode === 'solo') {
      const go = () => { slots.solo.typed = ''; app.showStats = false; return write(slots.solo.store, newSolo(s, Math.random, app.pool, app.hard)); };
      if (s && s.status === 'playing' && s.guesses.length) return askFirst('Give up this word and start a new one? It counts as a loss.', go);
      return go();
    }
    const go = (force) => { slots.friend.typed = ''; return write(slots.friend.store, createVs(app.me, s, Math.random, app.pool, app.hard), force ? {} : { refuseIfPlaying: true }); };
    if (s && s.status === 'playing' && seatOf(s, app.me.uid) !== null) return askFirst('Abandon this race and start a new one?', () => go(true));
    return go(false);
  },
  join() {
    const s = cur().state;
    try { joinVs(s, app.me); } catch {
      toast(s?.seats[0]?.uid === app.me.uid ? 'That’s your own game — send the link to your friend.' : 'This race already has two players.');
      return;
    }
    write(slots.friend.store, null, { apply: (c) => (c.status === 'waiting' && c.round === s.round && !c.seats[1] ? joinVs(c, app.me) : null) });
  },
  giveUp() {
    const s = stateOf(app.mode);
    const key = gameKey(s);
    const uid = app.me.uid;
    if (s.kind === 'solo') return askFirst('Give up and see the word?', () => write(slots.solo.store, null, { apply: (c) => (gameKey(c) === key && c.status === 'playing' ? soloGiveUp(c) : null) }));
    if (s.kind === 'daily') return askFirst('Give up on today’s word? You only get one a day.', () => write(slots.daily.store, null, { orCreate: true, apply: (c) => { const d = c || newDaily(s.date); return d.date === s.date ? dailyGiveUp(d, uid) : null; } }));
    askFirst('Give up this race? Your friend just has to solve it.', () => write(slots.friend.store, null, { apply: (c) => (gameKey(c) === key && c.status === 'playing' ? vsGiveUp(c, uid) : null) }));
  },
  hint() {
    const s = stateOf(app.mode);
    const my = mine(s);
    if (!s || !my.canHint) return;
    const choices = hintChoices(my.guesses, answerOf(s));
    if (!choices.length) return;
    const pos = choices[Math.floor(Math.random() * choices.length)];
    const key = gameKey(s);
    const uid = app.me.uid;
    askFirst('Use your hint? It shows one letter and costs one of your six guesses.', () => {
      let opts;
      if (s.kind === 'solo') opts = { apply: (c) => (gameKey(c) === key && c.status === 'playing' ? soloHint(c, pos) : null) };
      else if (s.kind === 'vs') opts = { apply: (c) => (gameKey(c) === key && c.status === 'playing' ? vsHint(c, uid, pos) : null) };
      else opts = { orCreate: true, apply: (c) => { const d = c || newDaily(s.date); return d.date === s.date ? dailyHint(d, uid, pos) : null; } };
      write(cur().store, null, opts);
    });
  },
  rematch() {
    const s = cur().state;
    if (s?.status !== 'over') { toast('The rematch has already started.'); return; }
    slots.friend.typed = '';
    write(slots.friend.store, null, { apply: (c) => (c.status === 'over' && c.round === s.round ? vsRematch(c) : null) });
  },
  setPool(pool) {
    if (!(pool in POOLS) || pool === app.pool) return;
    app.pool = pool; save('wordle:pool', pool);
    draw();
  },
  toggleHard() { app.hard = !app.hard; save('wordle:hard', app.hard ? '1' : '0'); draw(); },
  async share() {
    const s = stateOf(app.mode);
    const my = mine(s);
    if (!s || !my.done) return;
    let title = 'Sharkle';
    if (s.kind === 'daily') title = `Sharkle Daily ${s.date}`;
    else if (s.kind === 'vs') title = `Sharkle race (${s.winner === 'draw' ? 'tied' : s.winner === seatOf(s, app.me.uid) ? 'I won' : 'I lost'})`;
    const text = shareText({ title, guesses: my.guesses, answer: answerOf(s), time: my.board ? timeOf(my.board) : null, hard: Boolean(s.hard), hint: my.hint !== null });
    if (await copyText(text)) toast('📋 Copied — paste it to your friend!');
    else { app.shareBox = text; draw(); }
  },
  closeShare() { app.shareBox = ''; draw(); },
  toggleStats() { app.showStats = !app.showStats; draw(); },
  retry() { const sl = cur(); sl.err = null; subscribe(app.mode); draw(); },
  confirmYes() { const f = app.ask?.onYes; app.ask = null; draw(); f?.(); },
  confirmNo() { app.ask = null; draw(); },
};

let revealTimer;
function startReveal(mode, row) {
  app.reveal = { mode, row };
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => { app.reveal = null; draw(); afterState(); }, 150 * LEN + 400);
  draw();
}

const WIN_LINES = ['🦈 Jawsome! First try?!', '🌊 Fintastic!', '🐋 Whale done!', '🐠 Shore thing!', '🦀 Snappy!', '😅 Phew — close call!'];

// Toasts and shark effects when a game ends (held back while the last row is still flipping).
function afterState() {
  if (app.reveal) return;
  const s = stateOf(app.mode);
  const key = `${app.mode}|${gameKey(s)}|${phaseOf(s)}`;
  if (key === app.seenKey) return;
  const was = app.seenKey;
  app.seenKey = key;
  if (!s || phaseOf(s) !== 'over' || !was.endsWith('|playing')) return;
  const word = answerOf(s).toUpperCase();
  const my = mine(s);
  if (s.kind === 'vs') {
    const seat = seatOf(s, app.me.uid);
    if (seat === null) return;
    if (s.winner === 'draw') toast(`🤝 Dead heat! It was ${word}`, 3600);
    else if (s.winner === seat) { toast(`🏆 You out-swam them! It was ${word}`, 3600); playFx('win'); }
    else { toast(`🦈 They got there first. It was ${word}`, 3600); playFx('lose'); }
    return;
  }
  if (my.solved) { toast(WIN_LINES[my.guesses.length - 1] || WIN_LINES[5], 3200); playFx('win'); } else playFx('lose');
  if (s.kind === 'solo') app.showStats = true;
}

// ---------- physical keyboard ----------

function onKeyDown(e) {
  if (!root || root.hidden || root.closest('[hidden]')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (app.ask) { if (e.key === 'Escape') handlers.confirmNo(); return; }
  let k = null;
  if (e.key === 'Enter') k = 'enter';
  else if (e.key === 'Backspace') k = 'back';
  else if (/^[a-zA-Z]$/.test(e.key)) k = e.key.toLowerCase();
  if (!k) return;
  if (k === 'enter' && t?.tagName === 'BUTTON' && !t.dataset.key) return; // let Enter press a focused button
  e.preventDefault();
  handlers.key(k);
}

// ---------- subscriptions ----------

function subscribe(mode) {
  const sl = slots[mode];
  sl.unsub?.();
  sl.unsub = sl.store.subscribe(async (s, err) => {
    if (slots[mode] !== sl || (mode === 'daily' && s && s.date !== app.today)) return;
    sl.loaded = true;
    const active = () => mode === app.mode;
    if (err === 'lost') {
      sl.err = 'timeout';
      if (active()) draw();
      setTimeout(() => { if (slots[mode] === sl) { sl.err = null; subscribe(mode); } }, 3000);
      return;
    }
    if (err === 'timeout' && sl.state) { sl.err = 'timeout'; if (active()) draw(); return; }
    if (err === 'timeout' && mode === 'daily') err = undefined; // no save yet today is normal
    sl.err = err || null;
    if (err !== 'timeout') {
      if (gameKey(sl.state) !== gameKey(s) && mode !== 'daily') sl.typed = '';
      sl.state = s;
    }
    if (mode === 'friend') onTurnChange(needsMe(s, app.me.uid));
    if (mode === 'daily') recordToday();
    if (active()) { afterState(); draw(); }
    const known = (u) => u in app.names || u === app.me.uid;
    const uids = (s?.kind === 'vs' ? s.seats.filter(Boolean).map((p) => p.uid) : s?.kind === 'daily' ? Object.keys(s.boards) : []).filter((u) => !known(u));
    if (uids.length) { Object.assign(app.names, await sl.store.names(uids)); if (active()) draw(); }
  });
}

// Once today's word is finished, count it in your daily record (once per day).
async function recordToday() {
  const s = slots.daily.state;
  if (!record.store || !record.loaded || record.busy || !s || s.date !== app.today) return;
  const b = s.boards[app.me.uid];
  const answer = answerOf(s);
  if (!b || !boardDone(b, answer) || (app.dstats && app.dstats.last >= s.date)) return;
  const n = costOf(b, answer) || 0;
  record.busy = true;
  try { await record.store.write(null, null, undefined, { orCreate: true, apply: (c) => recordDaily(c, s.date, n) }); } catch { /* next snapshot retries */ }
  record.busy = false;
}

async function openRecord() {
  if (!openStore || !app.me.uid || record.store) return;
  record.store = await openStore(`wordledailyme/${app.me.uid}`, `dstats:${app.me.uid}`);
  record.store?.subscribe((s, err) => {
    if (err === 'lost' || err === 'broken') return;
    record.loaded = true;
    app.dstats = s?.kind === 'dstats' ? s : null;
    if (liveStreak(app.dstats, app.today) >= 5) award('streak5');
    recordToday();
    if (app.mode === 'daily') draw();
  });
}

// Today's shared save; reopened when the date rolls over.
async function openDaily() {
  if (!openStore) { slots.daily.loaded = true; return; }
  const date = dateKey();
  app.today = date;
  slots.daily.unsub?.();
  const sl = newSlot();
  slots.daily = sl;
  sl.store = await openStore(`wordledaily/${date}`, `daily:${date}`);
  if (slots.daily !== sl) return;
  if (sl.store) subscribe('daily'); else sl.loaded = true;
  if (app.mode === 'daily') { app.seenKey = ''; draw(); }
}

export async function mount(el, ctx) {
  root = el;
  onTurnChange = ctx.onTurnChange || (() => {});
  openStore = ctx.openStore || null;
  modeKey = ctx.modeKey || 'games:mode:wordle';
  slots.friend.store = ctx.store || null;
  slots.solo.store = ctx.botStore || null;
  let wanted = 'solo';
  try {
    wanted = localStorage.getItem(modeKey) || 'solo';
    const p = localStorage.getItem('wordle:pool'); if (p in POOLS) app.pool = p;
    app.hard = localStorage.getItem('wordle:hard') === '1';
  } catch { /* optional */ }
  if (wanted === 'friend' && slots.friend.store) app.mode = 'friend';
  if (!slots.solo.store && slots.friend.store) app.mode = 'friend';
  addEventListener('keydown', onKeyDown);
  draw();
  const any = slots.friend.store || slots.solo.store;
  if (!any) { for (const m of MODES) slots[m].loaded = true; draw(); return; }
  app.me = await any.me();
  for (const mode of ['solo', 'friend']) {
    if (slots[mode].store) subscribe(mode); else slots[mode].loaded = true;
  }
  draw();
  await openDaily();
  openRecord();
  if (wanted === 'daily' && slots.daily.store) { app.mode = 'daily'; app.seenKey = ''; }
  draw();
  setInterval(() => { if (dateKey() !== app.today) openDaily(); }, 60000);
  try { slots.friend.store?.onPeers((uids) => {
    const next = [...uids].sort();
    if (next.join('|') === app.peers.join('|')) return;
    app.peers = next;
    draw();
  }); } catch { /* presence is optional */ }
}
