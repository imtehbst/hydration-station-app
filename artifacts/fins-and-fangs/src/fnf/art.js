// Fins & Fangs — generated portrait art. Characters listed in ART have a
// picture in portraits/<id>.jpg; anyone else falls back to the drawn SVG.
// Sidekicks are drawn by the game as a badge on the portrait's corner, so
// they look the same on every card and screen.
import { portraitSVG } from './portraits.js';

export const ART = new Set(['c01','c02','c03','c04','c05','c06','c07','c08','c09','c10','c11','c12','c13','c14','c15','c16','c17','c18','c19','c20','c21','c22','c23','c24','c25','c26','c27','c28','c29','c30','c31','c32']);

const esc = (s) => String(s).replace(/"/g, '&quot;');

const SIDEKICK_SVG = {
  bat: '<path d="M12 9 Q9 6 6 8 Q4 6 1 8 Q3 11 3 14 Q6 12 8 14 Q10 12 12 15 Q14 12 16 14 Q18 12 21 14 Q21 11 23 8 Q20 6 18 8 Q15 6 12 9 Z" fill="#1a1222"/><circle cx="10.8" cy="10.5" r=".8" fill="#ff4a6a"/><circle cx="13.2" cy="10.5" r=".8" fill="#ff4a6a"/>',
  fish: '<path d="M3 12 Q9 5 16 12 Q9 19 3 12 Z" fill="#ff9a3c"/><path d="M15 12 L22 7 L21 12 L22 17 Z" fill="#ff7a1a"/><circle cx="7" cy="11" r="1.1" fill="#111"/>',
  cat: '<path d="M5 8 L7 3 L10 7 Q12 6.4 14 7 L17 3 L19 8 Q21 13 18 17 Q12 21 6 17 Q3 13 5 8 Z" fill="#141018"/><ellipse cx="9.5" cy="11.5" rx="1.4" ry="1.8" fill="#c8f04a"/><ellipse cx="14.5" cy="11.5" rx="1.4" ry="1.8" fill="#c8f04a"/><path d="M11 15 L12 16 L13 15" stroke="#ff7aa8" stroke-width=".9" fill="none"/>',
  seahorse: '<path d="M13 3 Q18 3 18 7 L15 8 Q16 11 14 14 Q12 17 14 19 Q15 21 12 21 Q9 20 10 17 Q8 13 11 10 Q9 7 11 5 Q11.5 3.5 13 3 Z" fill="#f2b134"/><path d="M11 5 L7 6.5 L10.5 7.5 Z" fill="#f2b134"/><circle cx="14.2" cy="5.8" r=".9" fill="#111"/><path d="M12 9 L9.5 10 M11 12 L8.6 12.8" stroke="#c88a1a" stroke-width=".8"/>',
};
const SIDEKICK_NAME = { bat: 'bat', fish: 'fish', cat: 'black cat', seahorse: 'seahorse' };

export function sidekickBadge(kind) {
  if (!SIDEKICK_SVG[kind]) return '';
  return `<span class="sidekick" title="Sidekick: ${SIDEKICK_NAME[kind]}"><svg viewBox="0 0 24 24" aria-label="Sidekick: ${SIDEKICK_NAME[kind]}">${SIDEKICK_SVG[kind]}</svg></span>`;
}

export function faceHTML(c) {
  const pic = ART.has(c.id)
    ? `<img src="portraits/${c.id}.jpg" alt="${esc(c.name)}" loading="lazy" decoding="async" draggable="false">`
    : portraitSVG(c);
  return c.sidekick ? `<span class="pic">${pic}${sidekickBadge(c.sidekick)}</span>` : pic;
}

export function cardBackHTML() {
  return '<img src="img/card-back.jpg" alt="Face-down card" decoding="async" draggable="false">';
}
