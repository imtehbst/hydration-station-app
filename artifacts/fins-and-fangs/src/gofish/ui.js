// Go Fish — rendering. You only ever see your own cards.
import { renderGame, playShell, playerRow, nameOf, wins, esc } from '../shared/frame.js';
import { byId } from '../fnf/cast.js';
import { faceHTML, cardBackHTML } from '../fnf/art.js';
import { KINDS } from './rules.js';

const LOGO = '<h1 class="logo"><span class="f">Go</span> <span class="amp">Fish</span></h1>';
const nm = (id) => esc(byId(id).name);

// What just happened, told from the viewer's side.
function lastLine(view) {
  const s = view.state, x = s.last;
  if (!x) return 'Ask for a character you already hold.';
  const who = nameOf(view, x.seat), them = nameOf(view, 1 - x.seat);
  const me = who === 'You';
  let t = `${esc(who)} asked ${me ? esc(them) : them === 'You' ? 'you' : esc(them)} for <b>${nm(x.ask)}</b>`;
  if (x.got) t += ` and got ${x.got}!`;
  else if (x.drew) t += ` — go fish! ${me ? 'You' : esc(who)} drew a card${x.lucky ? ` and it was ${nm(x.ask)}!` : '.'}`;
  else t += ' — no luck, and the pond is empty.';
  if (x.set) t += ` <span class="gf-setmade">Set of ${nm(x.set)}!</span>`;
  return t;
}

const setsHTML = (ids) => (ids.length ? ids.map((id) => `<span class="gf-set" title="${nm(id)}">${faceHTML(byId(id))}</span>`).join('') : '<small>No sets yet</small>');

const cfg = {
  cls: 'gf', logo: LOGO, title: '🐟 Go Fish', loading: 'Shuffling the cards…',
  blurb: 'Collect sets of four matching characters. Ask your friend for a character you already hold: if they have it, they hand over every one and you go again. If not, go fish!',
  play(view) {
    const s = view.state, seat = view.mySeat, over = s.status === 'over';
    const me = seat ?? 0, opp = 1 - me;
    const myTurn = seat !== null && !over && s.turn === seat;
    const turn = seat === null ? 'Watching' : over ? 'Game over' : myTurn ? 'Your turn — tap a card to ask for it' : view.bot ? `${nameOf(view, opp)} is thinking…` : `Waiting for ${nameOf(view, opp)}…`;
    const end = !over ? '' : `${wins(view, s.winner)} ${s.sets[s.winner].length}–${s.sets[1 - s.winner].length} 🐟`;
    const players = [0, 1].map((i) => playerRow(view, i, { icon: `<span class="nt-ico">${i === me ? '🫵' : '🐟'}</span>`, sub: `${s.hands[i].length} cards in hand`, count: s.sets[i].length, now: s.turn === i && !over })).join('');
    // my hand, grouped by character
    const kinds = s.chars.filter((id) => s.hands[me].includes(id));
    const hand = seat === null ? '<p class="gf-note">Hands are hidden while you watch.</p>' : kinds.length ? kinds.map((id) => {
      const n = s.hands[me].filter((c) => c === id).length, c = byId(id);
      return `<button class="gf-card" data-ask="${id}" ${myTurn && !view.busy ? '' : 'disabled'} aria-label="Ask for ${nm(id)} (you have ${n})">${faceHTML(c)}<span class="nm">${nm(id)}</span><b class="gf-n">×${n}</b></button>`;
    }).join('') : '<p class="gf-note">You have no cards.</p>';
    const backs = Array.from({ length: Math.min(s.hands[opp].length, 12) }, () => `<span class="gf-back">${cardBackHTML()}</span>`).join('');
    const board = `<div class="gf-col">` +
      `<div class="gf-row"><div class="gf-label">${esc(nameOf(view, opp))} · ${s.hands[opp].length} cards</div><div class="gf-backs">${backs || '<small>No cards</small>'}</div><div class="gf-sets">${setsHTML(s.sets[opp])}</div></div>` +
      `<div class="gf-mid"><span class="gf-pond">🌊 Pond: <b>${s.pool.length}</b></span><p class="gf-last">${lastLine(view)}</p><span class="gf-pond">Sets left: <b>${KINDS - s.sets[0].length - s.sets[1].length}</b></span></div>` +
      `<div class="gf-row"><div class="gf-label">${seat === null ? esc(nameOf(view, me)) : 'Your sets'}</div><div class="gf-sets">${setsHTML(s.sets[me])}</div></div>` +
      `<div class="gf-hand">${hand}</div></div>`;
    return playShell(view, { logo: LOGO, turn, myTurn, end, board, players, mainCls: 'gf-main' });
  },
  bind(root, h) {
    root.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', () => h.move(b.dataset.ask)));
  },
};
export const render = (root, view, h) => renderGame(root, view, h, cfg);
