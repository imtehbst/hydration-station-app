// Fins & Fangs — hand-built SVG portraits, assembled from trait parts.
// Every visible trait lives in <g data-part="...">, so the art can't drift
// from the data (tests check this).

const g = (part, body) => `<g data-part="${part}">${body}</g>`;

const BG = {
  emo: ['#2a1838', '#4a2a5e'],
  shark: ['#132a3a', '#1f4a63'],
  vampire: ['#2a0f1a', '#5a1a2e'],
  mermaid: ['#0b2a3a', '#0f5a6e'],
};

const MER_SKIN = ['#f2d6c4', '#d9a98a', '#f6dccb', '#b8805e', '#f0cdb8', '#e2b496', '#c98f6b', '#f4d9c8'];
const MER_HAIR = ['#6b4a33', '#e0c068', '#2a1a12', '#b5651d', '#3b2a1e', '#e0c068', '#2a1a12', '#6b4a33'];
const MER_DYED = ['#38e0d0', '#ff7aa8', '#9b5cff', '#38e0d0', '#ff7aa8', '#9b5cff', '#38e0d0', '#ff7aa8'];

const EMO_HAIR = ['#141018', '#1c1426', '#2b1638', '#141018', '#1a1222', '#2b1638', '#101014', '#22152e'];
const EMO_STREAK = ['#ff3fa4', '#38e0d0', '#d2304a', '#9b5cff', '#ff3fa4', '#38e0d0', '#d2304a', '#9b5cff'];
const EMO_TOP = ['#1b1b22', '#3a1f4a', '#1b1b22', '#5a1a2e', '#2a2a33', '#1b1b22', '#3a1f4a', '#22303a'];
const SHARK_SKIN = ['#7d93a6', '#6f8799', '#8a9db0', '#6a7f92', '#93a7b8', '#7a90a3', '#869aad', '#71879b'];
const SHARK_TOP = ['#e94f37', '#2f6fdb', '#f2b134', '#3ba55c', '#c33bff', '#ff7aa8', '#38e0d0', '#f25f5c'];
const VAMP_HAIR = ['#0e0b10', '#2a1a12', '#0e0b10', '#3a2a40', '#0e0b10', '#5a1a2e', '#1a1424', '#3b2a1e'];
const CAP = ['#c33bff', '#d2304a', '#38e0d0', '#f2b134'];

const SKIN_HUMAN = '#f2d6c4';
const SKIN_VAMP = '#e6e0f0';

// ---------- shared pieces ----------

function background(c) {
  const [a, b] = BG[c.species];
  const id = `bg-${c.id}`;
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>` +
    `<rect width="100" height="120" rx="8" fill="url(#${id})"/>` +
    `<path d="M0 0 L58 0 L22 120 L0 120 Z" fill="#ffffff" opacity="0.05"/>`;
}

const humanHead = (skin) =>
  `<rect x="44" y="80" width="12" height="14" fill="${skin}"/>` +
  `<ellipse cx="29.5" cy="62" rx="3.5" ry="5" fill="${skin}"/><ellipse cx="70.5" cy="62" rx="3.5" ry="5" fill="${skin}"/>` +
  `<ellipse cx="50" cy="60" rx="21" ry="25" fill="${skin}"/>`;

function humanEyes(color, liner, girl) {
  let s = '';
  for (const x of [42, 58]) {
    s += `<ellipse cx="${x}" cy="59" rx="4" ry="3" fill="#fff"/><circle cx="${x}" cy="59.3" r="2.1" fill="${color}"/><circle cx="${x}" cy="59.3" r="0.9" fill="#111"/>`;
    if (liner) s += `<path d="M${x - 5} 57.5 Q${x} 54.5 ${x + 5} 57.5 L${x + 6.5} 56" stroke="#111" stroke-width="1.4" fill="none"/>`;
  }
  return s;
}

const lashes = () =>
  [42, 58].map((x) => `<path d="M${x - 4} 56.5 l-1.8 -2.2 M${x} 55.6 l0 -2.6 M${x + 4} 56.5 l1.8 -2.2" stroke="#111" stroke-width="0.9"/>`).join('');

const nose = () => `<path d="M50 62 Q48.5 67 50.5 68" stroke="#b98d7a" stroke-width="1.1" fill="none"/>`;

function mouth(kind) {
  if (kind === 'smile') return `<path d="M43 74.5 Q50 79 57 74" stroke="#7a3b3b" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  if (kind === 'pout') return `<path d="M45 75 Q50 72.8 55 75" stroke="#7a3b3b" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  return `<path d="M44.5 75 L55.5 75" stroke="#7a3b3b" stroke-width="1.6" stroke-linecap="round"/>`;
}

const shoulders = (fill, trim) =>
  `<path d="M12 120 Q14 97 50 92 Q86 97 88 120 Z" fill="${fill}"/>` +
  (trim ? `<path d="M40 93 L50 104 L60 93" stroke="${trim}" stroke-width="2" fill="none"/>` : '');

// ---------- traits ----------

function glasses(c, i, y = 59) {
  const frame = c.species === 'shark' ? '#111' : (i % 2 ? '#d2304a' : '#111');
  const lens = i % 2
    ? [42, 58].map((x) => `<rect x="${x - 6}" y="${y - 4.5}" width="12" height="9" rx="2" fill="#bfe8ff" fill-opacity="0.25" stroke="${frame}" stroke-width="1.6"/>`).join('')
    : [42, 58].map((x) => `<circle cx="${x}" cy="${y}" r="5.6" fill="#bfe8ff" fill-opacity="0.25" stroke="${frame}" stroke-width="1.6"/>`).join('');
  return g('glasses', lens + `<path d="M47.6 ${y} Q50 ${y - 1.6} 52.4 ${y}" stroke="${frame}" stroke-width="1.6" fill="none"/>`);
}

function hat(c, i) {
  const col = CAP[i % 4];
  let body;
  if (c.species === 'vampire') {
    // a pulled-up cloak hood (no top hats: they looked like stage magicians)
    body = `<path d="M24 72 Q18 30 50 18 Q82 30 76 72 Q72 46 50 40 Q28 46 24 72 Z" fill="#141018"/>` +
      `<path d="M30 66 Q28 44 50 38 Q72 44 70 66" stroke="#d2304a" stroke-width="1.6" fill="none"/>`;
  } else if (c.species === 'mermaid') {
    // a gold shell crown
    body = `<path d="M32 38 L36 22 L43 33 L50 18 L57 33 L64 22 L68 38 Z" fill="#e8c46a" stroke="#a8842a" stroke-width="1"/>` +
      `<circle cx="50" cy="30" r="2.6" fill="#fff" stroke="#e8c46a" stroke-width="0.8"/><circle cx="38" cy="33" r="1.4" fill="#38e0d0"/><circle cx="62" cy="33" r="1.4" fill="#38e0d0"/>`;
  } else if (c.boy) {
    // baseball cap, brim to the side
    body = `<path d="M28 44 Q28 22 50 22 Q72 22 72 44 Z" fill="${col}"/><path d="M68 42 Q82 40 88 45 Q78 48 66 46 Z" fill="${col}" stroke="#00000055" stroke-width="0.8"/><circle cx="50" cy="23" r="2" fill="#ffffff88"/>`;
  } else {
    // slouchy beanie
    body = `<path d="M27 46 Q24 18 52 16 Q76 16 74 44 Z" fill="${col}"/><rect x="26" y="40" width="49" height="7" rx="3" fill="${col}" stroke="#00000044" stroke-width="0.8"/><path d="M34 40 L34 24 M42 40 L42 19 M50 40 L50 17 M58 40 L58 18 M66 40 L66 22" stroke="#00000022" stroke-width="1"/>`;
  }
  return g('hat', body);
}

function piercing(c) {
  const ring = (cx, cy, r = 2.4) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8c46a" stroke-width="1.3"/>`;
  if (c.featured === 'amr') return g('piercing', `<path d="M47.6 68.6 Q50 72.8 52.4 68.6" fill="none" stroke="#e8c46a" stroke-width="1.3"/>`);
  if (c.species === 'shark') return g('piercing', ring(50, 70.5) + ring(73.5, 64, 2));
  return g('piercing', ring(29.5, 68.5) + ring(70.5, 68.5) + `<circle cx="70.5" cy="58" r="1" fill="#e8c46a"/>`);
}

function beard(c) {
  if (c.featured === 'styles') {
    return g('beard', `<path d="M28 60 Q27 98 50 104 Q73 98 72 60 Q70 72 64 74 Q50 70 36 74 Q30 72 28 60 Z" fill="#5a3d26"/>` +
      `<path d="M38 100 q3 3 6 0 M48 103 q3 3 6 0 M57 100 q3 3 6 0 M33 92 q2 3 5 1 M62 93 q3 2 5 -1" stroke="#3d2818" stroke-width="1" fill="none"/>` +
      `<path d="M40 72 Q50 68 60 72 Q56 75 50 74 Q44 75 40 72 Z" fill="#4a3220"/>`);
  }
  if (c.species === 'shark') {
    return g('beard', `<path d="M38 70 Q44 66 50 69 Q56 66 62 70 Q58 73 50 71.5 Q42 73 38 70 Z" fill="#3a2a20"/><path d="M38 70 q-3 -1 -3 -4 M62 70 q3 -1 3 -4" stroke="#3a2a20" stroke-width="1.6" fill="none"/>`);
  }
  if (c.species === 'vampire') {
    return g('beard', `<path d="M44 79 L50 94 L56 79 Q50 82 44 79 Z" fill="${VAMP_HAIR[0]}"/><path d="M41 71 Q50 67 59 71 L57 73 Q50 70 43 73 Z" fill="${VAMP_HAIR[0]}"/>`);
  }
  return g('beard', `<path d="M30 62 Q31 90 50 92 Q69 90 70 62 Q68 76 60 79 Q50 76 40 79 Q32 76 30 62 Z" fill="#1c1426"/>`);
}

// ---------- species bases ----------

function emo(c, i) {
  if (c.featured === 'amr') return amr(c);
  if (c.featured === 'styles') return styles(c);
  const hair = EMO_HAIR[i], streak = EMO_STREAK[i];
  const back = c.boy ? '' : g('girl-cue', `<path d="M26 54 Q22 96 30 108 L40 104 Q32 84 34 60 Z" fill="${hair}"/><path d="M74 54 Q78 96 70 108 L60 104 Q68 84 66 60 Z" fill="${hair}"/>`);
  const base = shoulders(EMO_TOP[i], i % 2 ? '#d2304a' : '#555') + `<rect x="30" y="102" width="40" height="3" fill="${streak}" opacity="0.7"/>` + humanHead(SKIN_HUMAN);
  const fringe = `<path d="M27 60 C24 30 76 24 74 52 L72 47 C64 40 52 41 46 43 C40 50 36 62 31 68 Z" fill="${hair}"/>` +
    `<path d="M46 43 C42 52 38 60 33 66" stroke="${streak}" stroke-width="2.4" fill="none"/>`;
  const face = humanEyes(i % 3 === 0 ? '#5a7d9a' : '#3b2a1e', true) + nose() + mouth(i % 2 ? 'pout' : 'flat');
  return { back, base: g('species-emo', base + face + fringe), extra: c.boy ? '' : g('girl-cue', lashes()) };
}

function amr(c) {
  // cartoon of Alex: long wavy brown hair, curtain bangs, sun-kissed ends,
  // blue-grey eyes, septum ring, cream fleece coat
  const back = g('girl-cue',
    `<path d="M26 50 Q18 80 24 96 Q20 106 28 114 Q34 108 32 100 Q40 92 34 76 Q32 64 33 56 Z" fill="#6b4a33"/>` +
    `<path d="M74 50 Q82 80 76 96 Q80 106 72 114 Q66 108 68 100 Q60 92 66 76 Q68 64 67 56 Z" fill="#6b4a33"/>` +
    `<path d="M24 98 Q20 106 28 114 Q33 108 31 101 Z M76 98 Q80 106 72 114 Q67 108 69 101 Z" fill="#c89a5e"/>`);
  const base = `<path d="M12 120 Q14 97 50 92 Q86 97 88 120 Z" fill="#e8dcc8"/>` +
    `<path d="M40 93 Q50 100 60 93 L58 120 L42 120 Z" fill="#d8c9ae"/><circle cx="50" cy="108" r="2.6" fill="#8a6a4a"/>` +
    `<path d="M18 110 q4 -3 8 0 M70 104 q4 -3 8 0 M24 100 q3 -2 6 0" stroke="#cbbb9f" stroke-width="1.4" fill="none"/>` +
    humanHead('#f4d9c8');
  const top = `<path d="M28 58 C24 30 76 30 72 58 C70 46 62 40 54 39 Q50 44 50 46 Q50 44 46 39 C38 40 30 46 28 58 Z" fill="#6b4a33"/>` +
    `<path d="M50 40 C44 42 34 46 31 62 M50 40 C56 42 66 46 69 62" stroke="#7d5a40" stroke-width="2" fill="none"/>`;
  const face = humanEyes('#8fa9c4', true) + nose() + mouth('smile');
  return { back, base: g('species-emo', base + face + top), extra: g('girl-cue', lashes()) };
}

function styles(c) {
  // cartoon of Styles: messy slicked-back dark brown hair, big full beard,
  // blue eyes, half-smile, black emo hoodie
  const base = shoulders('#16141a', '#c33bff') + `<path d="M30 96 Q50 112 70 96" stroke="#2a2833" stroke-width="3" fill="none"/>` + humanHead('#f0cdb8');
  const hair = `<path d="M28 60 C21 36 33 20 52 20 C71 20 80 36 72 60 C71 49 67 43 61 41 C53 38 45 38 38 41 C33 44 30 51 28 60 Z" fill="#3b2a1e"/>` +
    `<path d="M38 40 C42 30 52 26 62 28 M45 38 C50 30 58 28 66 32 M34 46 C35 36 42 28 50 26 M56 38 C62 34 68 36 71 44" stroke="#5a4130" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M62 24 q5 -3 9 1 M40 23 q-4 -3 -8 1" stroke="#3b2a1e" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const face = humanEyes('#8fb0cf', false) + `<path d="M36 52 Q42 50 47 52 M53 52 Q58 50 64 52" stroke="#3b2a1e" stroke-width="2" fill="none"/>` + nose();
  // smile drawn by beard group's mouth; add half-smile above beard
  return { back: '', base: g('species-emo', base + face + hair), extra: '', mouthOverBeard: `<path d="M44 76 Q51 80 58 75" stroke="#7a3b3b" stroke-width="1.8" fill="none" stroke-linecap="round"/>` };
}

function shark(c, i) {
  const skin = SHARK_SKIN[i];
  const base = shoulders(SHARK_TOP[i], '#ffffff55') +
    `<path d="M50 10 Q58 26 66 42 L36 42 Q44 28 50 10 Z" fill="${skin}" stroke="#00000033" stroke-width="0.8"/>` +
    `<ellipse cx="50" cy="64" rx="27" ry="25" fill="${skin}"/>` +
    `<path d="M25 70 Q50 96 75 70 Q72 88 50 90 Q28 88 25 70 Z" fill="#e8eef2"/>` +
    `<path d="M28 62 l3 6 M31 60 l3 6 M69 60 l-3 6 M72 62 l-3 6" stroke="#00000044" stroke-width="1.1"/>` +
    [40, 60].map((x) => `<circle cx="${x}" cy="58" r="3.2" fill="#0b0b10"/><circle cx="${x + 1}" cy="57" r="1" fill="#fff"/>`).join('') +
    `<path d="M40 52 L46 55 M60 52 L54 55" stroke="#0b0b10" stroke-width="1.6"/>` +
    `<path d="M34 76 Q50 84 66 76 Q50 80 34 76 Z" fill="#3a0f18"/>` +
    `<path d="M36 76.5 l2 3 l2 -2.6 l2 3 l2 -2.6 l2 3 l2 -2.6 l2 3 l2 -2.6 l2 3 l2 -2.6 l2 3 l2 -2.6 l2 2.4" stroke="#fff" stroke-width="1" fill="#fff"/>`;
  const extra = c.boy ? '' : g('girl-cue', [40, 60].map((x) => `<path d="M${x - 3} 55 l-2 -2.4 M${x} 54.6 l0 -3 M${x + 3} 55 l2 -2.4" stroke="#0b0b10" stroke-width="1"/>`).join('') +
    `<ellipse cx="33" cy="68" rx="3.5" ry="2" fill="#ff7aa8" opacity="0.85"/><ellipse cx="67" cy="68" rx="3.5" ry="2" fill="#ff7aa8" opacity="0.85"/>`);
  return { back: '', base: g('species-shark', base), extra };
}

function vampire(c, i) {
  const hair = VAMP_HAIR[i];
  const back = c.boy ? '' : g('girl-cue', `<path d="M27 52 Q20 92 28 110 L38 106 Q32 86 34 60 Z" fill="${hair}"/><path d="M73 52 Q80 92 72 110 L62 106 Q68 86 66 60 Z" fill="${hair}"/>`);
  const collar = `<path d="M14 120 Q16 97 50 92 Q84 97 86 120 Z" fill="#141018"/>` +
    `<path d="M22 98 L10 62 L36 86 Z" fill="#d2304a"/><path d="M78 98 L90 62 L64 86 Z" fill="#d2304a"/>` +
    `<path d="M22 98 L14 70 L34 88 Z M78 98 L86 70 L66 88 Z" fill="#141018"/><path d="M44 94 L50 104 L56 94 Z" fill="#f2f2f2"/>`;
  const head = humanHead(SKIN_VAMP);
  const top = `<path d="M28 58 C24 28 76 28 72 58 C70 46 64 40 56 40 L50 50 L44 40 C36 40 30 46 28 58 Z" fill="${hair}"/>`;
  const face = `<path d="M36 52 L46 55 M64 52 L54 55" stroke="${hair}" stroke-width="2"/>` +
    [42, 58].map((x) => `<ellipse cx="${x}" cy="59" rx="4" ry="2.8" fill="#fff"/><circle cx="${x}" cy="59.3" r="2" fill="#b0102a"/>`).join('') +
    `<path d="M50 62 Q49 67 51 68" stroke="#a99bb8" stroke-width="1.1" fill="none"/>` +
    `<path d="M43 75 Q50 77 57 75" stroke="#5a1a2e" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M45.5 75.6 L47 80 L48.4 76 Z M51.6 76 L53 80 L54.5 75.6 Z" fill="#fff"/>`;
  const extra = c.boy ? '' : g('girl-cue', lashes() + `<path d="M44 75 Q50 77.5 56 75" stroke="#b0102a" stroke-width="2.2" fill="none"/>`);
  return { back, base: g('species-vampire', collar + head + face + top), extra };
}

function mermaid(c, i) {
  const skin = MER_SKIN[i];
  const hair = c.dyed ? MER_DYED[i] : MER_HAIR[i];
  const back = c.boy ? '' : g('girl-cue', `<path d="M26 50 Q16 86 26 112 L38 108 Q30 84 34 58 Z" fill="${hair}"/><path d="M74 50 Q84 86 74 112 L62 108 Q70 84 66 58 Z" fill="${hair}"/>`);
  // teal scales on the shoulders; a shell top for mermaids
  const body = `<path d="M12 120 Q14 97 50 92 Q86 97 88 120 Z" fill="${skin}"/>` +
    `<path d="M14 116 Q16 104 26 100 M86 116 Q84 104 74 100" stroke="#38e0d0" stroke-width="3" fill="none" opacity="0.7"/>` +
    (c.boy ? '' : `<path d="M34 112 Q38 100 46 108 Q42 116 34 112 Z M66 112 Q62 100 54 108 Q58 116 66 112 Z" fill="#ff7aa8"/>`);
  // fin-shaped ears instead of round ones
  const ears = `<path d="M30 56 L18 50 L22 62 L16 70 L30 66 Z" fill="#38e0d0" opacity="0.85"/><path d="M70 56 L82 50 L78 62 L84 70 L70 66 Z" fill="#38e0d0" opacity="0.85"/>`;
  const head = `<rect x="44" y="80" width="12" height="14" fill="${skin}"/><ellipse cx="50" cy="60" rx="21" ry="25" fill="${skin}"/>`;
  const top = c.boy
    ? `<path d="M28 58 C24 32 76 30 72 56 C68 44 58 40 50 42 C42 40 32 46 28 58 Z" fill="${hair}"/><path d="M36 44 q6 -6 12 -2 M52 42 q6 -5 12 0" stroke="#ffffff33" stroke-width="1.6" fill="none"/>`
    : `<path d="M27 60 C22 30 78 28 73 60 C70 46 62 40 52 40 Q44 44 38 48 C33 52 30 56 27 60 Z" fill="${hair}"/>`;
  const bubbles = `<circle cx="84" cy="24" r="3" fill="none" stroke="#bfe8ff88" stroke-width="1"/><circle cx="90" cy="14" r="2" fill="none" stroke="#bfe8ff88" stroke-width="1"/>`;
  const face = humanEyes(i % 2 ? '#2a8a8a' : '#3b6aa8', false) + nose() + mouth(i % 3 === 0 ? 'smile' : 'flat');
  const extra = c.boy ? '' : g('girl-cue', lashes());
  return { back, base: g('species-mermaid', bubbles + body + ears + head + face + top), extra };
}

// ---------- assembly ----------

export function portraitSVG(c) {
  const i = (Number(c.id.slice(1)) - 1) % 8;
  const parts = { emo, shark, vampire, mermaid }[c.species](c, i);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" role="img" aria-label="${c.name}">`;
  s += background(c) + parts.back + parts.base + parts.extra;
  if (c.beard) s += beard(c);
  if (parts.mouthOverBeard) s += parts.mouthOverBeard;
  if (c.piercing) s += piercing(c);
  if (c.glasses) s += glasses(c, i, c.species === 'shark' ? 58 : 59);
  if (c.hat) s += hat(c, i);
  return s + '</svg>';
}

export function cardBackSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" role="img" aria-label="Flipped card">` +
    `<defs><linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a1f4a"/><stop offset="1" stop-color="#16141a"/></linearGradient>` +
    `<pattern id="tri" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 12 L6 2 L12 12 Z" fill="#ffffff08"/></pattern></defs>` +
    `<rect width="100" height="120" rx="8" fill="url(#back)"/><rect width="100" height="120" rx="8" fill="url(#tri)"/>` +
    `<rect x="5" y="5" width="90" height="110" rx="6" fill="none" stroke="#c33bff" stroke-opacity="0.5" stroke-width="1.5"/>` +
    // fin
    `<path d="M30 74 Q40 40 56 30 Q52 52 58 74 Z" fill="#7d93a6"/>` +
    // fangs
    `<path d="M54 74 L60 92 L66 74 Z M66 74 L72 92 L78 74 Z" fill="#f2f2f2"/>` +
    `<path d="M24 74 L80 74" stroke="#d2304a" stroke-width="2.4" stroke-linecap="round"/>` +
    `</svg>`;
}
