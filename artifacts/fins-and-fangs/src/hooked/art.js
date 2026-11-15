// Hooked! art: shark sprites (generated, see art/hooked/) + drawn markers.
export const sharkImg = (id) => `hooked-art/${id}.png`;

// Hit: a bold red X with a soft glow (no background, so the shark shows through).
export const HIT_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true">' +
  '<path d="M10 10 L30 30 M30 10 L10 30" stroke="#ffffffcc" stroke-width="9" stroke-linecap="round"/>' +
  '<path d="M10 10 L30 30 M30 10 L10 30" stroke="#e8283f" stroke-width="5.5" stroke-linecap="round"/></svg>';

// Miss: a small dot (same look as squares known empty around a caught shark).
export const MISS_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="5" fill="#9fe6f5" opacity=".85"/></svg>';
