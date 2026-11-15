// Hooked! — wiring: store <-> rules <-> ui. Mounted by the games shell.
// Two games run side by side: the shared one with your friend ('friend')
// and your own one against a bot ('bot'). The screen shows the active mode;
// the tab's turn dot always follows the friend game.
import { SHARKS, fleetFor, cellsOf, validFleet, randomFleet, neighbours } from './fleets.js';
import { createGame, joinGame, placeFleet, castAt, rematch, seatOf, isMyTurn } from './rules.js';
import { chooseCast, botFleet, newBotGame } from './bot.js';
import { botLevel, isBot, THINK_MS, THINK_AGAIN_MS } from '../shared/bots.js';
import { render } from './ui.js';
import { sharkImg } from './art.js';
import { playFx } from '../wordle/fx.js';

let root = null;
let onTurnChange = () => {};
let modeKey = '';

const newSlot = () => ({ store: null, state: null, err: null, loaded: false, unsub: null });
const slots = { friend: newSlot(), bot: newSlot() };

const app = {
  mode: 'friend', botLevel: 'medium',
  store: null, me: { uid: '', name: '' }, state: null, err: null, loaded: false,
  peers: [], names: {}, toast: '', ask: null, busy: false,
  draft: null, draftKey: '', pick: null, dir: 'h', mobileTab: 'mine', lastTurn: null, choosingSize: false, lastCasts: 0, seen: false,
  pickerKey: '', abandonOK: false, sentFleet: null, resends: 0, salvo: false,
};

const mySeat = () => seatOf(app.state, app.me.uid);
// Which game this is: a new round, a new player or a new size makes it a different one.
const gameKey = (s) => (s ? `${s.round}|${s.seats.map((p) => p?.uid).join('|')}|${s.size}` : '');

function syncActive() {
  const sl = slots[app.mode];
  app.store = sl.store; app.state = sl.state; app.err = sl.err; app.loaded = sl.loaded;
}

function view() {
  const bot = app.mode === 'bot';
  const base = { me: app.me, state: app.state, names: app.names, toast: app.toast, confirm: app.ask, mode: app.mode, hasBot: Boolean(slots.bot.store), bot, botLevel: app.botLevel, salvo: app.salvo };
  if (!app.store) return { ...base, screen: 'message', message: app.loaded ? 'Sign in to play — this page can’t save games here.' : 'Baiting the hooks…' };
  if (app.err === 'broken' && !app.choosingSize) return { ...base, screen: 'message', message: 'Game data looks broken — start a new game.', action: 'new' };
  if (app.err === 'timeout' && !app.state) return { ...base, screen: 'message', message: 'Still connecting…', action: 'retry' };
  if (!app.loaded) return { ...base, screen: 'loading' };
  const banner = app.err === 'timeout' ? 'Reconnecting…' : '';
  const s = app.state;
  const seat = mySeat();
  const opp = s && seat !== null ? s.seats[1 - seat] : null;
  const peerOnline = Boolean(opp && app.peers.includes(opp.uid));
  const common = { ...base, mySeat: seat, banner, peerOnline, choosingSize: app.choosingSize };
  if (!s || s.status === 'waiting' || app.choosingSize) return { ...common, screen: 'lobby', state: app.choosingSize && app.err === 'broken' ? null : s };
  if (s.status === 'placing' && seat !== null) {
    return { ...common, screen: 'placing', draft: app.draft, pick: app.pick, dir: app.dir,
      fleetList: fleetFor(s.size), draftValid: validFleet(app.draft, s.size) };
  }
  if (s.status === 'placing') return { ...common, screen: 'lobby' }; // watcher during placing
  return { ...common, screen: 'fishing', mobileTab: app.mobileTab };
}

const draw = () => root && render(root, view(), handlers);

let toastTimer;
function toast(msg) {
  app.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { app.toast = ''; draw(); }, 2400);
  draw();
}

async function write(next, expectedTurnNo, expectedStatus, opts = {}) {
  if (app.busy) return false;
  app.busy = true;
  try {
    const ok = await app.store.write(next, expectedTurnNo, expectedStatus, opts);
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

// Draft placement helpers (local until Ready)
// 'ok' | 'edge' (off the tank / on another shark) | 'close' (touching another shark)
function fits(draft, sh, size) {
  const others = draft.filter((x) => x.id !== sh.id);
  const taken = new Set(others.flatMap((x) => cellsOf(x).map(([r, c]) => r * size + c)));
  if (!cellsOf(sh).every(([r, c]) => r >= 0 && c >= 0 && r < size && c < size && !taken.has(r * size + c))) return 'edge';
  if (neighbours(sh, size).some(([r, c]) => taken.has(r * size + c))) return 'close';
  return 'ok';
}

const handlers = {
  setMode(mode) {
    if (mode === app.mode || (mode === 'bot' && !slots.bot.store)) return;
    app.mode = mode;
    app.choosingSize = false; app.abandonOK = false; app.ask = null; app.sentFleet = null;
    app.seen = false; app.lastTurn = null;
    try { localStorage.setItem(modeKey, mode); } catch { /* optional */ }
    syncActive();
    afterState(app.state);
    draw();
  },
  setBotLevel(level) { app.botLevel = level; draw(); },
  toggleSalvo() {
    app.salvo = !app.salvo;
    try { localStorage.setItem('hooked:salvo', app.salvo ? '1' : '0'); } catch { /* optional */ }
    draw();
  },
  newGame(size) {
    const confirmed = app.abandonOK;
    app.choosingSize = false;
    app.abandonOK = false;
    const s = app.state;
    const round = (s?.round ?? 0) + 1;
    if (app.mode === 'bot') {
      const go = () => write(newBotGame(app.me, size, app.botLevel, Math.random, round, app.salvo), null);
      if (!confirmed && s && (s.status === 'playing' || s.status === 'placing')) return askFirst('Abandon this game and start a new one?', go);
      return go();
    }
    const go = (force) => write(createGame(app.me, size, s?.score ?? {}, round, app.salvo), null, undefined, force ? {} : { refuseIfPlaying: true });
    if (confirmed) return go(true); // already said yes to abandoning before the size picker
    if (s && (s.status === 'playing' || s.status === 'placing') && mySeat() !== null) return askFirst('Abandon this game and start a new one?', () => go(true));
    go(false);
  },
  restart() {
    const s = app.state;
    const pick = (ok) => { app.choosingSize = true; app.abandonOK = ok; app.pickerKey = gameKey(app.state); draw(); };
    if (s && (s.status === 'playing' || s.status === 'placing') && mySeat() !== null) return askFirst('Abandon this game and start a new one?', () => pick(true));
    pick(false);
  },
  cancelSize() { app.choosingSize = false; app.abandonOK = false; draw(); },
  join() {
    const s = app.state;
    try { joinGame(s, app.me); } catch {
      toast(s?.seats[0]?.uid === app.me.uid ? 'That’s your own game — send the link to your friend.' : 'This game already has two players.');
      return;
    }
    write(null, null, undefined, { apply: (cur) => (cur.status === 'waiting' && cur.round === s.round && !cur.seats[1] ? joinGame(cur, app.me) : null) });
  },
  pickShark(id) {
    if (app.draft?.some((x) => x.id === id)) { app.draft = app.draft.filter((x) => x.id !== id); }
    app.pick = id;
    draw();
  },
  rotate() { app.dir = app.dir === 'h' ? 'v' : 'h'; draw(); },
  shuffle() { app.draft = randomFleet(app.state.size); app.pick = null; draw(); },
  mineCell(r, c) {
    const s = app.state;
    if (!s || s.status !== 'placing' || mySeat() === null || s.fleets[mySeat()]) return;
    const draft = app.draft || [];
    if (app.pick) {
      const sh = { id: app.pick, len: SHARKS[app.pick].len, r, c, dir: app.dir };
      const f = fits(draft, sh, s.size);
      if (f === 'edge') { toast('It doesn’t fit there — try another square or ↻ Rotate.'); return; }
      if (f === 'close') { toast('Too close — sharks can’t touch, not even at the corners.'); return; }
      const order = fleetFor(s.size).map((f) => f.id);
      app.draft = [...draft.filter((x) => x.id !== sh.id), sh].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      const next = order.find((id) => !app.draft.some((x) => x.id === id));
      app.pick = next || null;
      draw();
      return;
    }
    const hit = draft.find((x) => cellsOf(x).some(([a, b]) => a === r && b === c));
    if (hit) { app.draft = draft.filter((x) => x.id !== hit.id); app.pick = hit.id; app.dir = hit.dir; draw(); }
  },
  async ready() {
    if (app.busy) return;
    const s = app.state;
    const seat = mySeat();
    if (!validFleet(app.draft, s.size)) return;
    // Remembered so the sharks are sent again if a slow, overlapping Ready
    // from the other player wrote over them (see afterState).
    app.sentFleet = { key: gameKey(s), seat, fleet: app.draft };
    app.resends = 0;
    await sendFleet(false);
  },
  async cast(r, c) {
    if (app.busy) return; // a quick second tap while the first is still saving
    const s = app.state;
    const seat = mySeat();
    let next;
    try { next = castAt(s, seat, r, c, s.turnNo); } catch { toast('You can’t cast there right now.'); return; }
    const ok = await write(null, null, undefined, {
      apply: (cur) => (cur.round === s.round && cur.turnNo === s.turnNo && cur.status === 'playing' ? castAt(cur, seat, r, c, s.turnNo) : null),
    });
    if (!ok) return;
    // Show the result now, so a quick next cast (after a bite) starts from it
    // instead of from the old board; the next snapshot brings the same state.
    if ((app.state?.turnNo ?? -1) < next.turnNo && app.state?.round === next.round) { app.state = next; app.lastCasts = next.casts.length; draw(); }
    const x = next.casts.at(-1);
    const casts = next.salvo && next.status === 'playing' && next.turn === seat ? ` ${next.shots} cast${next.shots === 1 ? '' : 's'} left.` : '';
    if (x.caught) {
      toast(`You hooked their ${SHARKS[x.caught].name}!${casts}`);
      if (next.status === 'playing') playFx('hook', { img: sharkImg(x.caught), text: `Hooked the ${SHARKS[x.caught].name}!` });
    } else if (next.salvo) toast(`${x.hit ? 'Bite!' : 'Splash…'}${casts}`);
    else toast(x.hit ? 'Bite! Cast again.' : 'Splash…');
  },
  rematch() {
    const s = app.state;
    if (s?.status !== 'over') { toast('The rematch has already started.'); return; }
    write(null, null, undefined, { apply: (cur) => (cur.status === 'over' && cur.round === s.round ? rematch(cur) : null) });
  },
  mobileTab(t) { app.mobileTab = t; draw(); },
  retry() { slots[app.mode].err = null; app.err = null; subscribe(app.mode); draw(); },
  confirmYes() { const f = app.ask?.onYes; app.ask = null; draw(); f?.(); },
  confirmNo() { app.ask = null; draw(); },
};

function sendFleet(quiet) {
  const { key, seat, fleet } = app.sentFleet;
  return write(null, null, undefined, {
    quiet,
    apply: (cur) => (gameKey(cur) === key && cur.status === 'placing' && cur.fleets[seat] === null ? placeFleet(cur, seat, fleet) : null),
  });
}

// Screen state for the game on screen, after a new snapshot or a mode switch.
function afterState(s) {
  const seat = mySeat();
  // fresh draft whenever a new placing phase starts for me
  const dk = s ? `${app.mode}|${gameKey(s)}` : '';
  if (s && s.status === 'placing' && seat !== null && dk !== app.draftKey) {
    app.draftKey = dk; app.draft = randomFleet(s.size); app.pick = null; app.dir = 'h';
  }
  // The size picker stays open through ordinary moves; it only closes when
  // the game itself changes (someone joined, or a new game was started).
  if (app.choosingSize && gameKey(s) !== app.pickerKey) { app.choosingSize = false; app.abandonOK = false; }
  // My Ready was written over by an overlapping one: send my sharks again.
  // Watched for the whole placing phase: in the race my sharks appear first
  // and are only written over afterwards.
  const sent = app.sentFleet;
  if (sent && (!s || gameKey(s) !== sent.key || s.status !== 'placing')) app.sentFleet = null;
  else if (sent && !s.fleets[sent.seat] && !app.busy && app.resends < 3) { app.resends++; sendFleet(true); }
  // the other player caught one of mine → tell me
  if (app.seen && s && seat !== null && s.casts.length > app.lastCasts) {
    const fresh = s.casts.slice(app.lastCasts).filter((x) => x.seat !== seat && x.caught);
    const them = s.seats[1 - seat];
    if (fresh.length) {
      toast(`${app.names[them.uid] || (isBot(them) ? them.name : 'They')} hooked your ${SHARKS[fresh.at(-1).caught].name}!`);
      if (s.status === 'playing') playFx('hook', { img: sharkImg(fresh.at(-1).caught), text: `They hooked your ${SHARKS[fresh.at(-1).caught].name}!`, bad: true });
    }
  }
  app.lastCasts = s ? s.casts.length : 0;
  app.seen = true;
  // phone: show the tank you need
  if (s && s.status === 'playing' && seat !== null && s.turn !== app.lastTurn) app.mobileTab = s.turn === seat ? 'theirs' : 'mine';
  app.lastTurn = s && s.status === 'playing' ? s.turn : null;
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
  if (!level || !sl.store) return;
  let delay, make;
  if (s0.status === 'placing' && s0.fleets[1] === null) {
    delay = 300;
    make = (cur) => (cur.status === 'placing' && cur.fleets[1] === null && gameKey(cur) === gameKey(s0) ? placeFleet(cur, 1, botFleet(cur)) : null);
  } else if (s0.status === 'playing' && s0.turn === 1) {
    delay = s0.casts.at(-1)?.seat === 1 ? THINK_AGAIN_MS : THINK_MS;
    make = (cur) => {
      if (gameKey(cur) !== gameKey(s0) || cur.turnNo !== s0.turnNo || cur.status !== 'playing' || cur.turn !== 1) return null;
      const { r, c } = chooseCast(cur, 1, level);
      return castAt(cur, 1, r, c, cur.turnNo);
    };
  } else {
    return;
  }
  const key = `${gameKey(s0)}|${s0.status}|${s0.turnNo}`;
  if (botTries.key !== key) botTries = { key, n: 0 };
  if (botTries.n >= 3) return;
  botTimer = setTimeout(async () => {
    botTimer = null;
    botTries.n++;
    let ok = false;
    try { ok = await sl.store.write(null, null, undefined, { apply: make }); } catch { ok = false; }
    if (!ok && slots.bot.state && `${gameKey(slots.bot.state)}|${slots.bot.state.status}|${slots.bot.state.turnNo}` === key) scheduleBot();
  }, delay);
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
    if (active()) {
      syncActive();
      afterState(app.state);
      draw();
    }
    const uids = s ? s.seats.filter((p) => p && !isBot(p)).map((p) => p.uid).filter((u) => !(u in app.names)) : [];
    if (uids.length) { Object.assign(app.names, await sl.store.names(uids)); if (active()) draw(); }
  });
}

// Mounted by the games shell. ctx.store: the shared game (hooked/current);
// ctx.botStore: your own bot game. Either is null when this view can't save.
export async function mount(el, ctx) {
  root = el;
  try { app.salvo = localStorage.getItem('hooked:salvo') === '1'; } catch { /* optional */ }
  onTurnChange = ctx.onTurnChange || (() => {});
  modeKey = ctx.modeKey || 'games:mode:hooked';
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
