// Board themes for the snakes & ladders tab. A theme only changes how the
// board looks and what the log says; the squares, jumps and saved game are
// the same for everyone. Each viewer picks their own (saved in their browser).
//
// art:
//   bg   board background (no grid; the game draws the numbered squares)
//   down / up  creature sprites drawn at the top end of each jump
//   blend / upBlend  'screen' for sprites cut from a black background (glowing ones)
//   upStyle / downStyle  how the creature reaches across its jump:
//     'end' (default) sprite at the top end + a drawn trail
//     'split'  head sprite at the top, tail strip (<kind>-tail.png) stretched to the far end
//     'repeat' a chain of smaller copies along the jump
// classic: true = no art; the game draws coloured squares, snakes and ladders.

export const THEMES = {
  anglers: {
    name: ['Anglers', 'Jellies'], icon: '🎣', tokens: ['🦈', '🐠'],
    blurb: 'Race up from the abyss. Jellyfish carry you up — anglerfish lure you back down into the dark!',
    down: 'an anglerfish lured {who} down to {to}', up: 'a jellyfish carried {who} up to {to}',
    downToast: '🎣 Snap! An anglerfish lured {who} down to {to}.', upToast: '🪼 Up you go! A jellyfish carried {who} up to {to}.',
    art: { bg: 'theme-art/anglers/bg.jpg', down: 'theme-art/anglers/down.png', up: 'theme-art/anglers/up.png', blend: 'normal', upBlend: 'screen', upStyle: 'split' },
  },
  crabs: {
    name: ['Crabs', 'Waves'], icon: '🦀', tokens: ['🐢', '🐚'],
    blurb: 'Scuttle up the beach to the tide pool. Waves wash you up — grumpy crabs pinch you back down!',
    down: 'a grumpy crab pinched {who} back to {to}', up: 'a wave washed {who} up to {to}',
    downToast: '🦀 Ouch! A grumpy crab pinched {who} back to {to}.', upToast: '🌊 Whoosh! A wave washed {who} up to {to}.',
    art: { bg: 'theme-art/crabs/bg.jpg', down: 'theme-art/crabs/down.png', up: 'theme-art/crabs/up.png', blend: 'normal', upStyle: 'repeat' },
  },
  ghosts: {
    name: ['Graves', 'Ghosts'], icon: '👻', tokens: ['🦇', '🕯️'],
    blurb: 'Cross the graveyard by moonlight. Friendly ghosts float you up — open graves drop you down!',
    down: 'an open grave dropped {who} down to {to}', up: 'a friendly ghost floated {who} up to {to}',
    downToast: '🪦 Thud! An open grave dropped {who} down to {to}.', upToast: '👻 Boo-yah! A friendly ghost floated {who} up to {to}.',
    art: { bg: 'theme-art/ghosts/bg.jpg', down: 'theme-art/ghosts/down.png', up: 'theme-art/ghosts/up.png', blend: 'normal', upBlend: 'screen', upStyle: 'split' },
  },
};

THEMES.classic = {
  name: ['Snakes', 'Ladders'], icon: '🐍', tokens: ['🔴', '🔵'], classic: true,
  blurb: 'The classic race to 100. Climb the ladders — but land on a snake and down you slide!',
  down: 'a snake slid {who} down to {to}', up: 'a ladder took {who} up to {to}',
  downToast: '🐍 Sssslide! A snake took {who} down to {to}.', upToast: '🪜 Up you go! A ladder took {who} up to {to}.',
  art: null,
};

export const THEME_IDS = Object.keys(THEMES);
export const DEFAULT_THEME = 'anglers';
const KEY = 'eels:theme';

export function loadTheme(storage = globalThis.localStorage) {
  try { const t = storage?.getItem(KEY); if (THEMES[t]) return t; } catch { /* optional */ }
  return DEFAULT_THEME;
}
export function saveTheme(id, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, id); } catch { /* optional */ }
}

export const fill = (tpl, who, to) => tpl.replace('{who}', who).replace('{to}', to);
