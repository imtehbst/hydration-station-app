// Shark Drop — wiring: store <-> rules <-> ui. Mounted by the games shell.
// Like the other tabs, two games run side by side: the shared one with your
// friend ('friend') and your own one against a bot ('bot'; the bot is seat 1).
import { createGame, joinGame, drop, canDrop, rematch, seatOf, isMyTurn } from './rules.js';
import { chooseMove, newBotGame } from './bot.js';
import { botLevel, isBot, THINK_MS } from '../shared/bots.js';
import { render } from './ui.js';

let root = null;
let onTurnChange = () => {};
let modeKey = '';

const newSlot = () => ({ store: null, state: null, err: null, loaded: false, unsub: null });
const slots = { friend: newSlot(), bot: newSlot() };

const app = {
  mode: 'friend', botLevel: 'medium', store: null, me: { uid: '', name: '' }, state: null, err: null, loaded: false,
  peers: [], names: {}, toast: '', ask: null, busy: false, seenKey: '', botRound: 0,
};

const mySeat = () => seatOf(app.state, app.me.uid);
const gameKey = (s) => (s ? `${s.round}|${s.seats.map((p) => p?.uid).join('|')}` : '');

function syncActive() {
  const sl = slots[app.mode];
  app.store = sl.store; app.state = sl.state; app.err = sl.err; app.loaded = sl.loaded;
}

function view() {
  const bot = app.mode === 'bot';
  const base = { me: app.me, state: app.state, names: app.names, toast: app.toast, confirm: app.ask, mode: app.mode, hasBot: Boolean(slots.bot.store), bot, botLevel: app.botLevel, busy: app.busy };
  if (!app.store) return { ...base, screen: 'message', message: app.loaded ? 'Sign in to play — this page can’t save games here.' : 'Chumming the water…' };
  if (app.err === 'broken') return { ...base, screen: 'message', message: 'Game data looks broken — start a new game.', action: 'new' };
  if (app.err === 'timeout' && !app.state) return { ...base, screen: 'message', message: 'Still connecting…', action: 'retry' };
  if (!app.loaded) return { ...base, screen: 'loading' };
  const s = app.state;
  const seat = mySeat();
  const opp = s && seat !== null ? s.seats[1 - seat] : null;
  const common = { ...base, mySeat: seat, banner: app.err === 'timeout' ? 'Reconnecting…' : '', peerOnline: Boolean(opp && app.peers.includes(opp.uid)) };
  if (!s || s.status === 'waiting') return { ...common, screen: 'lobby' };
  return { ...common, screen: 'play' };
}

const draw = () => root && render(root, view(), handlers);

let toastTimer;
function toast(msg) {
  app.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { app.toast = ''; draw(); }, 2600);
  draw();
}

async function write(next, opts = {}) {
  if (app.busy) return false;
  app.busy = true;
  try {
    const ok = await app.store.write(next, null, undefined, opts);
    if (!ok && !opts.quiet) toast('That didn’t go through — the game has caught up. Try again if it’s still your move.');
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

const handlers = {
  setMode(mode) {
    if (mode === app.mode || (mode === 'bot' && !slots.bot.store)) return;
    app.mode = mode;
    app.ask = null;
    try { localStorage.setItem(modeKey, mode); } catch { /* optional */ }
    syncActive();
    draw();
  },
  setBotLevel(level) { app.botLevel = level; draw(); },
  newGame() {
    const s = app.state;
    const round = (s?.round ?? (app.mode === 'bot' ? app.botRound : 0)) + 1;
    if (app.mode === 'bot') {
      const go = () => write(newBotGame(app.me, app.botLevel, round));
      if (s && s.status === 'playing') return askFirst('Abandon this game and start a new one?', go);
      return go();
    }
    const go = (force) => write(createGame(app.me, s?.score ?? {}, round), force ? {} : { refuseIfPlaying: true });
    if (s && s.status === 'playing' && mySeat() !== null) return askFirst('Abandon this game and start a new one?', () => go(true));
    go(false);
  },
  restart() {
    // vs bot: back to the level picker; with a friend: a fresh game
    if (app.mode === 'bot') {
      const s = app.state;
      const clear = () => { app.botRound = s?.round ?? app.botRound; slots.bot.state = null; syncActive(); draw(); };
      if (s && s.status === 'playing') return askFirst('Abandon this game and pick a new bot?', clear);
      return clear();
    }
    handlers.newGame();
  },
  join() {
    const s = app.state;
    try { joinGame(s, app.me); } catch {
      toast(s?.seats[0]?.uid === app.me.uid ? 'That’s your own game — send the link to your friend.' : 'This game already has two players.');
      return;
    }
    write(null, { apply: (cur) => (cur.status === 'waiting' && cur.round === s.round && !cur.seats[1] ? joinGame(cur, app.me) : null) });
  },
  async drop(col) {
    if (app.busy) return;
    const s = app.state;
    const seat = mySeat();
    if (!isMyTurn(s, app.me.uid) || !canDrop(s, col)) return;
    await write(null, { apply: (cur) => (gameKey(cur) === gameKey(s) && cur.turnNo === s.turnNo && cur.status === 'playing' ? drop(cur, seat, col, s.turnNo) : null) });
  },
  rematch() {
    const s = app.state;
    if (s?.status !== 'over') { toast('The rematch has already started.'); return; }
    write(null, { apply: (cur) => (cur.status === 'over' && cur.round === s.round ? rematch(cur) : null) });
  },
  retry() { slots[app.mode].err = null; app.err = null; subscribe(app.mode); draw(); },
  confirmYes() { const f = app.ask?.onYes; app.ask = null; draw(); f?.(); },
  confirmNo() { app.ask = null; draw(); },
};

// A pop-up when the game ends.
function afterState(s) {
  const key = `${app.mode}|${gameKey(s)}|${s?.status}`;
  if (key === app.seenKey) return;
  const was = app.seenKey;
  app.seenKey = key;
  if (!s || s.status !== 'over' || !was.endsWith('|playing')) return;
  const seat = mySeat();
  if (seat === null) return;
  if (s.winner === 'draw') toast('🤝 A draw!');
  else if (s.winner === seat) toast(s.winner === 0 ? '🦈 Chomp! Four sharks in a row!' : '🐙 Four octopuses in a row!');
  else toast(s.winner === 0 ? '🦈 The sharks got four in a row.' : '🐙 The octopuses got four in a row.');
}

// ---------- the bot's turns (bot seat is always 1) ----------

let botTimer = null;
function scheduleBot() {
  clearTimeout(botTimer);
  botTimer = null;
  const sl = slots.bot;
  const s0 = sl.state;
  const level = s0 && botLevel(s0.seats[1]);
  if (!level || s0.status !== 'playing' || s0.turn !== 1 || !sl.store) return;
  botTimer = setTimeout(async () => {
    botTimer = null;
    try {
      await sl.store.write(null, null, undefined, {
        apply: (cur) => (gameKey(cur) === gameKey(s0) && cur.turnNo === s0.turnNo && cur.status === 'playing' && cur.turn === 1 ? drop(cur, 1, chooseMove(cur, 1, level), cur.turnNo) : null),
      });
    } catch { /* the next snapshot reschedules */ }
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
    if (mode === 'friend') onTurnChange(isMyTurn(s, app.me.uid));
    else scheduleBot();
    if (active()) { syncActive(); afterState(app.state); draw(); }
    const uids = s ? s.seats.filter((p) => p && !isBot(p)).map((p) => p.uid).filter((u) => !(u in app.names)) : [];
    if (uids.length) { Object.assign(app.names, await sl.store.names(uids)); if (active()) draw(); }
  });
}

export async function mount(el, ctx) {
  root = el;
  onTurnChange = ctx.onTurnChange || (() => {});
  modeKey = ctx.modeKey || 'games:mode:drop';
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
