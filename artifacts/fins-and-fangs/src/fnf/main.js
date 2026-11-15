// Fins & Fangs — wiring: store <-> rules <-> ui.
// Two games run side by side: the shared one with your friend ('friend')
// and your own one against a bot ('bot'). The screen shows the active mode;
// the tab's turn dot always follows the friend game.
import { byId } from './cast.js';
import { createGame, joinGame, applyMove, rematch, seatOf, candidates } from './rules.js';
import { chooseMove, newBotGame } from './bot.js';
import { botLevel, isBot, THINK_MS } from '../shared/bots.js';
import { render } from './ui.js';

let root = null;
let onTurnChange = () => {};
let modeKey = '';

const newSlot = () => ({ store: null, state: null, err: null, loaded: false, unsub: null });
const slots = { friend: newSlot(), bot: newSlot() };

const app = {
  mode: 'friend', picking: false,
  store: null, me: { uid: '', name: '' }, state: null, err: null, loaded: false,
  peers: [], names: {}, peeks: new Set(), guessMode: false, toast: '', ask: null, viewSeat: null, lastTurn: null, busy: false, gameKey: '', series: false,
};

// copy the active mode's game into the fields the screen reads
function syncActive() {
  const sl = slots[app.mode];
  app.store = sl.store; app.state = sl.state; app.err = sl.err; app.loaded = sl.loaded;
}

function view() {
  const bot = app.mode === 'bot';
  const base = {
    me: app.me, state: app.state, names: app.names, peeks: app.peeks, guessMode: app.guessMode, toast: app.toast, confirm: app.ask, viewSeat: app.viewSeat,
    mode: app.mode, hasBot: Boolean(slots.bot.store), bot, series: app.series,
  };
  if (!app.store) return { ...base, screen: 'message', message: app.loaded ? 'Sign in to play — this page can’t save games here.' : 'Summoning the moody ones…' };
  if (bot && app.loaded && (app.picking || !app.state)) return { ...base, screen: 'botlobby' };
  if (app.err === 'broken') return { ...base, screen: 'message', message: 'Game data looks broken — start a new game.', action: 'new' };
  if (app.err === 'timeout' && !app.state) return { ...base, screen: 'message', message: 'Still connecting…', action: 'retry' };
  const banner = app.err === 'timeout' ? 'Reconnecting…' : '';
  if (!app.loaded) return { ...base, screen: 'loading' };
  const s = app.state;
  const mySeat = seatOf(s, app.me.uid);
  const opp = s && mySeat !== null ? s.seats[1 - mySeat] : null;
  const peerOnline = Boolean(opp && app.peers.includes(opp.uid));
  if (!s || s.status === 'waiting') return { ...base, screen: 'lobby', mySeat, banner, peerOnline };
  return { ...base, screen: s.status === 'over' ? 'end' : 'board', mySeat, banner, peerOnline };
}

const draw = () => root && render(root, view(), handlers);

let toastTimer;
function toast(msg) {
  app.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { app.toast = ''; draw(); }, 2600);
  draw();
}

async function write(next, expectedTurnNo, expectedStatus, opts) {
  if (app.busy) return;
  app.busy = true;
  try {
    const ok = await app.store.write(next, expectedTurnNo, expectedStatus, opts);
    if (!ok) toast('That didn’t go through — the board has caught up. Try again if it’s still your move.');
  } catch {
    toast('Couldn’t save that move. Check your connection and try again.');
  } finally {
    app.busy = false;
  }
}

function askFirst(text, onYes) { app.ask = { text, onYes }; draw(); }

const mySeat = () => seatOf(app.state, app.me.uid);

const handlers = {
  setMode(mode) {
    if (mode === app.mode || (mode === 'bot' && !slots.bot.store)) return;
    app.mode = mode;
    app.picking = false;
    app.ask = null;
    try { localStorage.setItem(modeKey, mode); } catch { /* optional */ }
    syncActive();
    afterState();
    draw();
  },
  newGame() {
    const s = app.state;
    if (app.mode === 'bot') {
      const open = () => { app.picking = true; draw(); };
      if (s && s.status === 'playing') return askFirst('Abandon this game and start a new one?', open);
      return open();
    }
    const go = (force) => write(createGame(app.me, app.state?.score ?? {}, 2, app.series), null, undefined, force ? {} : { refuseIfPlaying: true });
    if (s && s.status === 'playing' && mySeat() !== null) return askFirst('Abandon this game and start a new one?', () => go(true));
    go(false);
  },
  botStart(level) {
    app.picking = false;
    write(newBotGame(app.me, level, Math.random), null);
  },
  cancelPick() { app.picking = false; draw(); },
  toggleSeries() {
    app.series = !app.series;
    try { localStorage.setItem('fnf:series', app.series ? '1' : '0'); } catch { /* optional */ }
    draw();
  },
  join() {
    const s = app.state;
    try { write(joinGame(s, app.me, Math.random), s.turnNo, 'waiting'); } catch {
      toast(s?.seats[0]?.uid === app.me.uid ? 'That’s your own game — send the link to your friend.' : 'This game already has two players.');
    }
  },
  ask(q) {
    const s = app.state;
    try { write(applyMove(s, mySeat(), { kind: 'ask', q }, s.turnNo), s.turnNo, 'playing'); } catch { toast('You can’t ask that right now.'); }
  },
  toggleGuess() {
    const s = app.state;
    if (s?.lastChance && s.turn === mySeat()) { app.guessMode = true; draw(); return; } // guessing is the only move left
    app.guessMode = !app.guessMode;
    draw();
  },
  viewBoard(seat) { app.viewSeat = seat; app.guessMode = false; draw(); },
  cardClick(id) {
    const s = app.state;
    const seat = mySeat();
    if (seat === null || s.status !== 'playing') return;
    const faceUp = candidates(s, seat).includes(id);
    if (app.guessMode && faceUp) {
      askFirst(`Guess ${byId(id).name}? If you're wrong, your turn ends.`, () => {
        app.guessMode = false;
        const cur = app.state;
        try { write(applyMove(cur, seat, { kind: 'guess', charId: id }, cur.turnNo), cur.turnNo, 'playing'); } catch { toast('You can’t guess that right now.'); }
      });
      return;
    }
    if (!faceUp) {
      app.peeks.has(id) ? app.peeks.delete(id) : app.peeks.add(id);
      draw();
    }
  },
  rematch() {
    const s = app.state;
    try { write(rematch(s, Math.random), s.turnNo, 'over'); } catch { toast('The rematch has already started.'); }
  },
  retry() { slots[app.mode].err = null; app.err = null; subscribe(app.mode); draw(); },
  confirmYes() { const f = app.ask?.onYes; app.ask = null; draw(); f?.(); },
  confirmNo() { app.ask = null; draw(); },
};

// Per-game screen state follows the game on screen.
function afterState() {
  const s = app.state;
  const key = s ? `${app.mode}|${s.round || 1}|${s.seats.map((p) => p?.uid).join('|')}|${s.secrets.join('|')}` : app.mode;
  if (key !== app.gameKey) { app.gameKey = key; app.peeks = new Set(); app.guessMode = false; app.viewSeat = null; }
  // your turn just started: jump back to your own board
  const me = mySeat();
  if (s && me !== null && s.turn === me && app.lastTurn !== me) app.viewSeat = null;
  app.lastTurn = s ? s.turn : null;
  if (s && s.turn !== me) app.guessMode = false;
  // my last chance: questions are off, so go straight to guessing
  if (s && s.status === 'playing' && s.lastChance && me !== null && s.turn === me) { app.guessMode = true; app.viewSeat = null; }
}

// ---------- the bot's turns (bot seat is always 1) ----------

let botTimer = null;
let botTries = { key: '', n: 0 };
function scheduleBot() {
  clearTimeout(botTimer);
  botTimer = null;
  const sl = slots.bot;
  const s0 = sl.state;
  const level = s0 && botLevel(s0.seats[1]);
  if (!level || !sl.store || s0.status !== 'playing' || s0.turn !== 1) return;
  const key = `${s0.round}|${s0.turnNo}|${s0.secrets.join()}`;
  if (botTries.key !== key) botTries = { key, n: 0 };
  if (botTries.n >= 3) return;
  botTimer = setTimeout(async () => {
    botTimer = null;
    botTries.n++;
    const same = (cur) => cur.round === s0.round && cur.turnNo === s0.turnNo && cur.status === 'playing' && cur.turn === 1 && cur.secrets.join() === s0.secrets.join();
    let ok = false;
    try {
      ok = await sl.store.write(null, null, undefined, { apply: (cur) => (same(cur) ? applyMove(cur, 1, chooseMove(cur, 1, level, Math.random), cur.turnNo) : null) });
    } catch { ok = false; }
    if (!ok && slots.bot.state && same(slots.bot.state)) scheduleBot(); // lease busy or offline: try again
  }, THINK_MS);
}

// ---------- subscriptions ----------

function subscribe(mode) {
  const sl = slots[mode];
  sl.unsub?.();
  sl.unsub = sl.store.subscribe(async (s, err) => {
    sl.loaded = true;
    const active = () => mode === app.mode;
    if (err === 'lost') {
      sl.err = 'timeout';
      if (active()) { syncActive(); draw(); }
      setTimeout(() => { sl.err = null; subscribe(mode); }, 3000);
      return;
    }
    if (err === 'timeout' && sl.state) { sl.err = 'timeout'; if (active()) { syncActive(); draw(); } return; }
    sl.err = err || null;
    if (err !== 'timeout') sl.state = s;
    if (mode === 'friend') {
      const me = seatOf(s, app.me.uid);
      onTurnChange(Boolean(s && s.status === 'playing' && me !== null && s.turn === me));
    } else {
      scheduleBot();
    }
    if (active()) { syncActive(); afterState(); draw(); }
    const uids = s ? s.seats.filter((p) => p && !isBot(p)).map((p) => p.uid).filter((u) => !(u in app.names)) : [];
    if (uids.length) { Object.assign(app.names, await sl.store.names(uids)); if (active()) draw(); }
  });
}

// Mounted by the games shell. ctx.store: the shared game (games/current);
// ctx.botStore: your own bot game. Either is null when this view can't save.
export async function mount(el, ctx) {
  root = el;
  onTurnChange = ctx.onTurnChange || (() => {});
  modeKey = ctx.modeKey || 'games:mode:fins';
  try { app.series = localStorage.getItem('fnf:series') === '1'; } catch { /* optional */ }
  slots.friend.store = ctx.store || null;
  slots.bot.store = ctx.botStore || null;
  try { if (localStorage.getItem(modeKey) === 'bot' && slots.bot.store) app.mode = 'bot'; } catch { /* optional */ }
  syncActive();
  draw();
  const any = slots.friend.store || slots.bot.store;
  if (!any) { slots.friend.loaded = slots.bot.loaded = true; syncActive(); draw(); return; }
  app.me = await any.me();
  for (const mode of ['friend', 'bot']) {
    if (slots[mode].store) subscribe(mode); else slots[mode].loaded = true;
  }
  syncActive();
  draw();
  try { slots.friend.store?.onPeers((uids) => {
    const next = [...uids].sort();
    if (next.join('|') === app.peers.join('|')) return;
    app.peers = next;
    draw();
  }); } catch { /* presence is optional */ }
}
