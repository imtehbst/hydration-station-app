// Hangshark — rendering.
import { renderGame, playShell, playerRow, nameOf, wins, esc } from '../shared/frame.js';
import { wordOf, missesOf, guesserOf, cleanWord, wordOk, MIN_LEN, MAX_LEN } from './rules.js';

const LOGO = '<h1 class="logo"><span class="f">Hang</span><span class="amp">shark</span></h1>';
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

// The shark closes in on the swimmer with every miss.
function seaHTML(misses, max, lost) {
  const gap = 78 * (1 - misses / max); // % of the track left between them
  return `<div class="hs-sea${lost ? ' lost' : ''}"><span class="hs-shark" style="left:${78 - gap}%">🦈</span><span class="hs-swimmer">${lost ? '💀' : '🏊'}</span>` +
    `<span class="hs-count">${max - misses} ${max - misses === 1 ? 'miss' : 'misses'} left</span></div>`;
}

const cfg = {
  cls: 'hs', logo: LOGO, title: '🏊 Hangshark', loading: 'The shark is circling…',
  blurb: 'One of you sets a secret word, the other guesses it a letter at a time. Every wrong letter brings the shark closer. You swap roles each round.',
  botBlurb: 'The bot picks the word and you guess. Easy uses sea words, Medium everyday words, Hard gives you fewer misses.',
  play(view) {
    const s = view.state, seat = view.mySeat, over = s.status === 'over';
    const setter = s.setter, guesser = guesserOf(s);
    const players = [0, 1].map((i) => playerRow(view, i, { icon: `<span class="nt-ico">${i === setter ? '✍️' : '🔎'}</span>`, sub: i === setter ? 'Sets the word' : 'Guesses', now: !over && s.turn === i })).join('');
    if (s.status === 'setting') {
      const mine = seat === setter;
      const board = mine
        ? `<div class="hs-col"><p class="hs-big">Choose a secret word for ${esc(nameOf(view, guesser))}.</p>` +
          `<div class="hs-set"><input data-keep id="hsWord" type="text" maxlength="${MAX_LEN}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${MIN_LEN}–${MAX_LEN} letters"><button class="big" data-hs="set">Set word</button></div>` +
          '<p class="hs-note">Letters only. They won’t see it.</p></div>'
        : `<div class="hs-col"><p class="hs-big">${esc(nameOf(view, setter))} is choosing a word…</p>${seaHTML(0, s.maxMiss, false)}</div>`;
      return playShell(view, { logo: LOGO, turn: seat === null ? 'Watching' : mine ? 'Your turn — set the word' : `Waiting for ${nameOf(view, setter)}…`, myTurn: mine, board, players, mainCls: 'hs-main' });
    }
    const word = wordOf(s), misses = missesOf(s);
    const iGuess = seat === guesser, myTurn = iGuess && !over && !view.busy;
    const lost = over && s.winner === setter;
    const showAll = over || seat === setter;
    const letters = [...word].map((l) => `<i class="${s.guessed.includes(l) ? 'hit' : showAll ? 'shown' : ''}">${s.guessed.includes(l) || showAll ? l : ''}</i>`).join('');
    const keys = ROWS.map((row) => `<div class="krow">${[...row].map((k) => {
      const used = s.guessed.includes(k);
      return `<button class="hs-key ${used ? (word.includes(k) ? 'hit' : 'miss') : ''}" data-letter="${k}" ${myTurn && !used ? '' : 'disabled'}>${k}</button>`;
    }).join('')}</div>`).join('');
    const turn = seat === null ? 'Watching' : over ? 'Round over' : iGuess ? 'Your turn — guess a letter' : `${nameOf(view, guesser)} is guessing…`;
    const end = !over ? '' : s.winner === guesser ? `${wins(view, guesser)} — got the word! 🎉` : `${wins(view, setter)} — the shark got ${nameOf(view, guesser) === 'You' ? 'you' : 'them'} 🦈`;
    const endExtra = `<p>The word was <b>${esc(word.toUpperCase())}</b></p>`;
    const board = `<div class="hs-col">${seaHTML(misses, s.maxMiss, lost)}<div class="hs-word">${letters}</div><div class="hs-keys">${keys}</div>` +
      (seat === setter && !over ? '<p class="hs-note">You set this word, so you can see it.</p>' : '') + '</div>';
    return playShell(view, { logo: LOGO, turn, myTurn: iGuess && !over, end, endExtra, board, players, mainCls: 'hs-main', again: view.bot ? 'Next word' : 'Next round (swap roles)' });
  },
  bind(root, h) {
    root.querySelectorAll('[data-letter]').forEach((b) => b.addEventListener('click', () => h.move({ t: 'guess', l: b.dataset.letter })));
    const input = root.querySelector('#hsWord');
    const submit = () => {
      const w = cleanWord(input.value);
      if (!wordOk(w)) { h.toast(`Use ${MIN_LEN} to ${MAX_LEN} letters, with no spaces or numbers.`); return; }
      h.move({ t: 'word', w });
    };
    root.querySelector('[data-hs="set"]')?.addEventListener('click', submit);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  },
};
export const render = (root, view, h) => renderGame(root, view, h, cfg);
