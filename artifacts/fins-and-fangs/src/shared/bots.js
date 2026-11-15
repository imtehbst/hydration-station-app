// Bot opponents shared by both games. A bot is an ordinary player object
// whose uid says its level ('bot:easy' | 'bot:medium' | 'bot:hard').
export const LEVELS = ['easy', 'medium', 'hard'];
export const LEVEL_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export const botPlayer = (level) => ({ uid: `bot:${level}`, name: `🤖 ${LEVEL_LABEL[level]} bot` });

export function botLevel(p) {
  const m = /^bot:(easy|medium|hard)$/.exec(p?.uid || '');
  return m ? m[1] : null;
}

export const isBot = (p) => botLevel(p) !== null;

export const pick = (arr, rng) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

// How long the bot "thinks" before a move, in ms.
export const THINK_MS = 900;
export const THINK_AGAIN_MS = 700; // Hooked!: casting again after a bite
