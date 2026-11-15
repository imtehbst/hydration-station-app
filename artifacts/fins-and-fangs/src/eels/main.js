// Eels & Bubbles — wiring: store <-> rules <-> ui. Mounted by the games shell.
// Like Hooked!, two games run side by side: the shared one with your friend
// ('friend') and your own one against the bot ('bot').
import { createGame, joinGame, roll, offerDice, moveFrom, rematch, seatOf, isMyTurn, newBotGame, GOAL, MODES } from './rules.js';
import { isBot, THINK_MS } from '../shared/bots.js';
import { render } from './ui.js';
import { THEMES, loadTheme, saveTheme, fill } from './themes.js';

let root = null;
let onTurnChange = () => {};
let modeKey = '';

const newSlot = () => ({ store: null, state: null, err: null, loaded: false, unsub: null });
const slots = { friend: newSlot(), bot: newSlot() };

const app = {
  mode: 'friend', store: null, me: { uid: '', name: '' }, state: null, err: null, loaded: false,
  peers: [], names: {}, toast: '', ask: null, busy: false,
  shown: [0, 0], seenKey: '', seenTurnNo: -1, animating: false, rolling: false, die: null, anim: 0,
  theme: loadTheme(), themeOpen: false, variant: 'classic', fast: false,
};
const d6 = () => 1 + Math.floor(Math.random() * 6);

const mySeat = () => seatOf(app.state, app.me.uid);
const gameKey = (s) => (s ? `${s.round}|${s.seats.map((p) => p?.uid).join('|')}` : '');

function syncActive() {
  const sl = slots[app.mode];
  app.store = sl.store; app.state = sl.state; app.err = sl.err; app.loaded = sl.loaded;
}

function view() {
  const bot = app.mode === 'bot';
  const base = { me: app.me, state: app.state, names: app.names, toast: app.toast, confirm: app.ask, mode: app.mode, hasBot: Boolean(slots.bot.store), bot, theme: app.theme, themeOpen: app.themeOpen, variant: app.variant, fast: app.fast, busy: app.busy };
  if (!app.store) return { ...base, screen: 'message', message: app.loaded ? 'Sign in to play — this page can’t save games here.' : 'Filling the ocean…' };
  if (app.err === 'broken') return { ...base, screen: 'message', message: 'Game data looks broken — start a new game.', action: 'new' };
  if (app.err === 'timeout' && !app.state) return { ...base, screen: 'message', message: 'Still connecting…', action: 'retry' };
  if (!app.loaded) return { ...base, screen: 'loading' };
  const s = app.state;
  const seat = mySeat();
  const opp = s && seat !== null ? s.seats[1 - seat] : null;
  const common = { ...base, mySeat: seat, banner: app.err === 'timeout' ? 'Reconnecting…' : '', peerOnline: Boolean(opp && app.peers.includes(opp.uid)) };
  if (!s || s.status === 'waiting') return { ...common, screen: 'lobby' };
  return { ...common, screen: 'play', shown: app.shown, animating: app.animating, rolling: app.rolling, die: app.die };
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
    snap(app.state);
    draw();
  },
  newGame() {
    const s = app.state;
    const round = (s?.round ?? 0) + 1;
    if (app.mode === 'bot') {
      const go = () => write(newBotGame(app.me, round, app.variant));
      if (s && s.status === 'playing') return askFirst('Abandon this race and start a new one?', go);
      return go();
    }
    const go = (force) => write(createGame(app.me, s?.score ?? {}, round, app.variant), force ? {} : { refuseIfPlaying: true });
    if (s && s.status === 'playing' && mySeat() !== null) return askFirst('Abandon this race and start a new one?', () => go(true));
    go(false);
  },
  restart() { handlers.newGame(); },
  toggleThemes() { app.themeOpen = !app.themeOpen; draw(); },
  setTheme(id) {
    if (!THEMES[id]) return;
    app.theme = id; app.themeOpen = false;
    saveTheme(id);
    draw();
  },
  join() {
    const s = app.state;
    try { joinGame(s, app.me); } catch {
      toast(s?.seats[0]?.uid === app.me.uid ? 'That’s your own game — send the link to your friend.' : 'This game already has two players.');
      return;
    }
    write(null, { apply: (cur) => (cur.status === 'waiting' && cur.round === s.round && !cur.seats[1] ? joinGame(cur, app.me) : null) });
  },
  async roll() {
    if (app.busy || app.animating) return;
    const s = app.state;
    const seat = mySeat();
    if (!isMyTurn(s, app.me.uid)) return;
    const same = (cur) => gameKey(cur) === gameKey(s) && cur.turnNo === s.turnNo && cur.status === 'playing';
    if (s.mode === 'pick') {
      // two dice go on the table; you choose one with pick()
      if (s.offer) return;
      const dice = [d6(), d6()];
      await write(null, { apply: (cur) => (same(cur) && !cur.offer ? offerDice(cur, seat, dice, s.turnNo) : null) });
      draw();
      return;
    }
    const die = d6();
    await write(null, { apply: (cur) => (same(cur) ? roll(cur, seat, die, s.turnNo) : null) });
  },
  async pick(i) {
    if (app.busy || app.animating) return;
    const s = app.state;
    const seat = mySeat();
    const die = s?.offer?.dice?.[i];
    if (!isMyTurn(s, app.me.uid) || s.offer?.seat !== seat || !die) return;
    await write(null, { apply: (cur) => (gameKey(cur) === gameKey(s) && cur.turnNo === s.turnNo && cur.status === 'playing' && cur.offer ? roll(cur, seat, die, s.turnNo) : null) });
  },
  setVariant(v) {
    if (!MODES.includes(v)) return;
    app.variant = v;
    try { localStorage.setItem('eels:variant', v); } catch { /* optional */ }
    draw();
  },
  toggleFast() {
    app.fast = !app.fast;
    try { localStorage.setItem('eels:fast', app.fast ? '1' : '0'); } catch { /* optional */ }
    draw();
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

// ---------- token animation ----------

// Jump straight to the saved positions (new game, mode switch, catching up).
function snap(s) {
  app.anim++;
  app.animating = false; app.rolling = false; app.die = null;
  app.shown = s ? s.pos.slice() : [0, 0];
  app.seenKey = `${app.mode}|${gameKey(s)}`;
  app.seenTurnNo = s ? s.turnNo : -1;
}

const wait = (ms) => new Promise((r) => setTimeout(r, app.fast ? ms * 0.3 : ms)); // ⚡ Fast shortens every pause

async function animate(x) {
  const id = ++app.anim;
  const alive = () => id === app.anim;
  app.animating = true; app.rolling = true;
  for (let i = 0; i < 6; i++) { app.die = 1 + Math.floor(Math.random() * 6); draw(); await wait(70); if (!alive()) return; }
  app.rolling = false; app.die = x.die; draw();
  for (let k = 1; k <= x.die; k++) {
    await wait(170); if (!alive()) return;
    const p = x.from + k;
    app.shown[x.seat] = p > GOAL ? 2 * GOAL - p : p;
    draw();
  }
  if (x.via) {
    await wait(450); if (!alive()) return;
    app.shown[x.seat] = x.to;
  }
  app.animating = false;
  draw();
  const s = app.state;
  const mine = x.seat === mySeat();
  const who = mine ? 'you' : (app.names[s?.seats[x.seat]?.uid] || s?.seats[x.seat]?.name || 'them');
  const T = THEMES[app.theme] || THEMES.anglers;
  if (x.via === 'eel') toast(fill(T.downToast, who, x.to));
  else if (x.via === 'bubble') toast(fill(T.upToast, who, x.to));
}

function afterState(s) {
  const key = `${app.mode}|${gameKey(s)}`;
  if (!s || key !== app.seenKey || s.turnNo !== app.seenTurnNo + 1 || !s.rolls.length) {
    if (!(s && key === app.seenKey && s.turnNo === app.seenTurnNo)) snap(s);
    return;
  }
  app.seenTurnNo = s.turnNo;
  animate(s.rolls.at(-1));
}

// ---------- the bot's turns (bot seat is always 1) ----------

let botTimer = null;
function scheduleBot() {
  clearTimeout(botTimer);
  botTimer = null;
  const sl = slots.bot;
  const s0 = sl.state;
  if (!s0 || !isBot(s0.seats[1]) || s0.status !== 'playing' || s0.turn !== 1 || !sl.store) return;
  botTimer = setTimeout(async function go() {
    if (app.mode === 'bot' && app.animating) { botTimer = setTimeout(go, 300); return; }
    botTimer = null;
    // Pick a die: the bot rolls two and takes whichever leaves it higher up
    const dice = [d6(), d6()];
    const best = moveFrom(s0.pos[1], dice[0]).to >= moveFrom(s0.pos[1], dice[1]).to ? dice[0] : dice[1];
    const move = (cur) => (cur.mode === 'pick' ? roll({ ...cur, offer: { seat: 1, dice } }, 1, best, cur.turnNo) : roll(cur, 1, dice[0], cur.turnNo));
    try {
      await sl.store.write(null, null, undefined, { apply: (cur) => (gameKey(cur) === gameKey(s0) && cur.turnNo === s0.turnNo && cur.status === 'playing' && cur.turn === 1 ? move(cur) : null) });
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
  modeKey = ctx.modeKey || 'games:mode:eels';
  slots.friend.store = ctx.store || null;
  slots.bot.store = ctx.botStore || null;
  try { if (localStorage.getItem(modeKey) === 'bot' && slots.bot.store) app.mode = 'bot'; } catch { /* optional */ }
  try { const v = localStorage.getItem('eels:variant'); if (MODES.includes(v)) app.variant = v; app.fast = localStorage.getItem('eels:fast') === '1'; } catch { /* optional */ }
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
