// Games shell: tab bar + both games mounted (inactive one hidden).
import { tabFromHash } from './shell-tabs.js';
import { mountHub, validateReaction } from './hub.js';
import { createLocalStore, createArtifactStore } from './shared/store.js';
import { validateState as fnfValidate } from './fnf/rules.js';
import { mount as mountFnf } from './fnf/main.js';
import { mount as mountHooked } from './hooked/main.js';
import { validateState as hookedValidate } from './hooked/rules.js';
import { mount as mountEels } from './eels/main.js';
import { validateState as eelsValidate } from './eels/rules.js';
import { mount as mountTtt } from './ttt/main.js';
import { validateState as tttValidate } from './ttt/rules.js';
import { mount as mountWordle } from './wordle/main.js';
import { validateState as wordleValidate } from './wordle/rules.js';
import { mount as mountDrop } from './drop/main.js';
import { validateState as dropValidate } from './drop/rules.js';
import { mount as mountMemory } from './memory/main.js';
import { validateState as memoryValidate } from './memory/rules.js';
import { mount as mountGoFish } from './gofish/main.js';
import { validateState as goFishValidate } from './gofish/rules.js';
import { mount as mountCheckers } from './checkers/main.js';
import { validateState as checkersValidate } from './checkers/rules.js';
import { mount as mountNets } from './nets/main.js';
import { validateState as netsValidate } from './nets/rules.js';
import { mount as mountHang } from './hang/main.js';
import { validateState as hangValidate } from './hang/rules.js';
import { mount as mountFlood } from './flood/main.js';
import { validateState as floodValidate } from './flood/rules.js';
import { validateTrophies, validateHistory } from './shared/trophies.js';

// path = the shared game with your friend; botPath = your own game vs a bot
const GAMES = [
  { id: 'fins', icon: '🦈', name: 'Fins & Fangs', path: 'games/current', botPath: (uid) => `fnfbot/${uid}`, key: 'fnf:game', validate: fnfValidate, mount: mountFnf },
  { id: 'hooked', icon: '🎣', name: 'Hooked!', path: 'hooked/current', botPath: (uid) => `hookedbot/${uid}`, key: 'hooked:game', validate: hookedValidate, mount: mountHooked },
  { id: 'eels', icon: '🐍', name: 'Snakes & Ladders', path: 'eels/current', botPath: (uid) => `eelsbot/${uid}`, key: 'eels:game', validate: eelsValidate, mount: mountEels },
  { id: 'ttt', icon: '🐙', name: 'Tic Tac Toe', path: 'ttt/current', botPath: (uid) => `tttbot/${uid}`, key: 'ttt:game', validate: tttValidate, mount: mountTtt },
  { id: 'drop', icon: '🫧', name: 'Shark Drop', path: 'drop/current', botPath: (uid) => `dropbot/${uid}`, key: 'drop:game', validate: dropValidate, mount: mountDrop },
  { id: 'memory', icon: '🧠', name: 'Memory Match', path: 'memory/current', botPath: (uid) => `memorybot/${uid}`, key: 'memory:game', validate: memoryValidate, mount: mountMemory },
  { id: 'gofish', icon: '🐟', name: 'Go Fish', path: 'gofish/current', botPath: (uid) => `gofishbot/${uid}`, key: 'gofish:game', validate: goFishValidate, mount: mountGoFish },
  { id: 'checkers', icon: '🪸', name: 'Coral Checkers', path: 'checkers/current', botPath: (uid) => `checkersbot/${uid}`, key: 'checkers:game', validate: checkersValidate, mount: mountCheckers },
  { id: 'nets', icon: '🥅', name: 'Fishing Nets', path: 'nets/current', botPath: (uid) => `netsbot/${uid}`, key: 'nets:game', validate: netsValidate, mount: mountNets },
  { id: 'hang', icon: '🏊', name: 'Hangshark', path: 'hang/current', botPath: (uid) => `hangbot/${uid}`, key: 'hang:game', validate: hangValidate, mount: mountHang },
  { id: 'flood', icon: '🎨', name: 'Color Tide', path: 'flood/current', botPath: (uid) => `floodbot/${uid}`, key: 'flood:game', validate: floodValidate, mount: mountFlood },
  // Sharkle: botPath holds your solo words; path is the race with your friend
  { id: 'wordle', icon: '🦷', name: 'Sharkle', path: 'wordle/current', botPath: (uid) => `wordlesolo/${uid}`, key: 'wordle:game', validate: wordleValidate, mount: mountWordle },
];

const app = document.getElementById('app');
const dev = new URLSearchParams(location.search).get('dev');
const stored = (() => { try { return localStorage.getItem('games:tab'); } catch { return null; } })();
let active = tabFromHash(location.hash, stored);

app.innerHTML = `<nav class="tabs">${GAMES.map((g) => `<button class="tab" data-tab="${g.id}" title="${g.name}"><span class="tabicon">${g.icon}</span><span class="tabname"> ${g.name}</span><span class="tabdot" hidden></span></button>`).join('')}</nav><div class="hub" id="hub"></div>` +
  GAMES.map((g) => `<section class="game" id="game-${g.id}"></section>`).join('');

function show(id) {
  active = id;
  for (const g of GAMES) {
    app.querySelector(`#game-${g.id}`).hidden = g.id !== id;
    app.querySelector(`[data-tab="${g.id}"]`).classList.toggle('on', g.id === id);
  }
  try { if (location.hash.replace('#', '') !== id) history.replaceState(null, '', '#' + id); } catch { /* optional */ }
  try { localStorage.setItem('games:tab', id); } catch { /* optional */ }
}
app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
addEventListener('hashchange', () => show(tabFromHash(location.hash, active)));
show(active);

async function waitForClaude(ms) {
  const t0 = Date.now();
  while (!globalThis.claude?.use && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 100));
}

async function makeStore(g, bot) {
  if (dev) return createLocalStore(bot ? `${g.key}:bot:${dev}` : g.key, dev, dev, g.validate);
  try { return await createArtifactStore(bot ? g.botPath : g.path, g.validate); } catch { return null; }
}

(async () => {
  if (!dev) await waitForClaude(3000);
  const entries = [];
  for (const g of GAMES) {
    const [store, botStore] = await Promise.all([makeStore(g, false), makeStore(g, true)]);
    entries.push({ g, store, botStore });
  }
  // the strip under the tabs: scores, whose turn, reactions, sound
  let hub = null;
  const pendingTurns = {};
  mountHub(app.querySelector('#hub'), entries, {
    show,
    getActive: () => active,
    // the strip's own saves: reactions, your trophies, the shared match history
    openDoc: async (path, key, validate) => {
      const check = validate || (path.startsWith('trophies/') ? validateTrophies : validateHistory);
      if (dev) return createLocalStore(key, dev, dev, check);
      try { return await createArtifactStore(path, check); } catch { return null; }
    },
  }).then((h) => { hub = h; for (const [id, mine] of Object.entries(pendingTurns)) h.setTurn(id, mine); }).catch(() => {});
  for (const { g, store, botStore } of entries) {
    const dot = app.querySelector(`[data-tab="${g.id}"] .tabdot`);
    // openStore: an extra shared save for this game (Sharkle's daily word)
    const openStore = async (path, key) => {
      if (dev) return createLocalStore(`${g.key}:${key}`, dev, dev, g.validate);
      try { return await createArtifactStore(path, g.validate); } catch { return null; }
    };
    const onTurnChange = (mine) => { dot.hidden = !mine; if (hub) hub.setTurn(g.id, mine); else pendingTurns[g.id] = mine; };
    g.mount(app.querySelector(`#game-${g.id}`), { store, botStore, openStore, modeKey: `games:mode:${g.id}`, onTurnChange });
  }
})();
