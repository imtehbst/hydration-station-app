// Shark effects, drawn over the page so redraws of a game don't restart them.
// Used by Sharkle (win / lose) and Hooked! (a shark gets hooked).
const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function playFx(kind, opts = {}) {
  if (typeof document === 'undefined' || calm()) return;
  document.querySelectorAll('.wd-fx').forEach((n) => n.remove());
  const el = document.createElement('div');
  el.className = `wd-fx wd-fx-${kind}`;
  el.setAttribute('aria-hidden', 'true');
  if (kind === 'win') {
    // a shark swims across, trailing bubbles
    const bubbles = Array.from({ length: 7 }, (_, i) => `<i style="--d:${i * 0.12}s;--x:${8 + i * 7}%;--y:${(i * 37) % 60 - 30}px">🫧</i>`).join('');
    el.innerHTML = `<div class="swim"><span class="shark">🦈</span>${bubbles}</div>`;
  } else if (kind === 'hook') {
    // a hooked shark is reeled up past the screen
    el.innerHTML = `<div class="reel ${opts.bad ? 'bad' : ''}"><i></i><img src="${esc(opts.img || '')}" alt=""><b>${esc(opts.text || 'Hooked!')}</b></div>`;
  } else {
    // jaws snap shut over the screen
    el.innerHTML = '<div class="jaw top"></div><div class="jaw bottom"></div><b>CHOMP!</b>';
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), kind === 'win' ? 2800 : kind === 'hook' ? 2000 : 1500);
}
