// Fins & Fangs — the 24 characters. Pure data.
// Layout per species (boy, glasses, hat); piercing = boy^glasses^hat
// (inverted for emo so Alex — no glasses, no hat — has her septum ring).

const LAYOUT = [
  [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1],
  [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1],
];

// Beards: which boys (by glasses,hat) have facial hair, per species.
const BEARDS = {
  emo: ['0,0', '1,0'],
  shark: ['0,1', '1,1'],
  vampire: ['0,0', '1,1'],
};

const NAMES = {
  emo: ['Styles', 'Corvin', 'Jett', 'Damien', 'Alex', 'Nyx', 'Lilith', 'Ember'],
  shark: ['Gill', 'Chomp', 'Finnick', 'Snapper', 'Coral', 'Marina', 'Reefa', 'Splash'],
  vampire: ['Vex', 'Count Grim', 'Sorrow', 'Bram', 'Velvet', 'Noctua', 'Crimson', 'Raven'],
};

const FEATURED = { 'emo:Styles': 'styles', 'emo:Alex': 'amr' };

function build() {
  const out = [];
  let n = 1;
  for (const species of ['emo', 'shark', 'vampire']) {
    LAYOUT.forEach(([b, g, h], i) => {
      const parity = b ^ g ^ h;
      const name = NAMES[species][i];
      const c = {
        id: 'c' + String(n++).padStart(2, '0'),
        name,
        species,
        boy: b === 1,
        beard: b === 1 && BEARDS[species].includes(`${g},${h}`),
        glasses: g === 1,
        hat: h === 1,
        piercing: species === 'emo' ? parity === 0 : parity === 1,
      };
      const f = FEATURED[`${species}:${name}`];
      if (f) c.featured = f;
      c.dyed = DYED.has(name);
      c.sidekick = SIDEKICKS[name] || null;
      out.push(Object.freeze(c));
    });
  }
  for (const m of MERMAIDS) {
    out.push(Object.freeze({
      id: 'c' + String(n++).padStart(2, '0'), species: 'mermaid',
      beard: false, glasses: false, hat: false, piercing: false, dyed: false, sidekick: null, ...m,
    }));
  }
  return Object.freeze(out);
}

// ---------- deck v2 (2026-11-04): mermaids + two rarer traits ----------
// Bright dyed hair (streaks count) and a small sidekick badge drawn by the
// game. Rare traits make the choice of question matter (see the v2 spec).
const DYED = new Set(['Corvin', 'Jett', 'Nyx', 'Ember', 'Noctua']);
const SIDEKICKS = { Lilith: 'cat', Finnick: 'fish', Sorrow: 'bat' };
const MERMAIDS = [
  { name: 'Pearl', boy: false },
  { name: 'Nerissa', boy: false, dyed: true },
  { name: 'Shelly', boy: false, hat: true, dyed: true },
  { name: 'Lorelei', boy: false, piercing: true, dyed: true },
  { name: 'Kai', boy: true },
  { name: 'Caspian', boy: true, beard: true },
  { name: 'Wade', boy: true, glasses: true },
  { name: 'Tide', boy: true, hat: true, sidekick: 'seahorse' },
];

/** Every card in the game (v2 deck). byId works for all of them. */
export const CAST = build();
/** The original 24 (v1 games). */
export const CAST_V1 = Object.freeze(CAST.slice(0, 24));

export const QUESTIONS = Object.freeze([
  { id: 'emo', text: 'Is your character an emo kid?' },
  { id: 'shark', text: 'Is your character a shark?' },
  { id: 'vampire', text: 'Is your character a vampire?' },
  { id: 'mermaid', text: 'Is your character a mermaid?' },
  { id: 'boy', text: 'Is your character a boy?' },
  { id: 'beard', text: 'Do they have facial hair?' },
  { id: 'glasses', text: 'Do they wear glasses?' },
  { id: 'hat', text: 'Are they wearing a hat or headwear?' },
  { id: 'piercing', text: 'Do they have a piercing or earring?' },
  { id: 'dyed', text: 'Do they have brightly coloured hair? (streaks count)' },
  { id: 'sidekick', text: 'Do they have a sidekick?' },
]);
export const QUESTIONS_V1 = Object.freeze(QUESTIONS.filter((q) => !['mermaid', 'dyed', 'sidekick'].includes(q.id)));

/** The cards and questions a game uses, by its version (1 = original 24). */
export const deckFor = (v) => (v === 1 ? CAST_V1 : CAST);
export const questionsFor = (v) => (v === 1 ? QUESTIONS_V1 : QUESTIONS);

const INDEX = new Map(CAST.map((c) => [c.id, c]));
export const byId = (id) => INDEX.get(id);
