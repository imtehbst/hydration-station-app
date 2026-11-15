// Pure helpers for the games tab.
export const TABS = ['fins', 'hooked', 'eels', 'ttt', 'drop', 'memory', 'gofish', 'checkers', 'nets', 'hang', 'flood', 'wordle'];
export function tabFromHash(hash, stored) {
  const h = String(hash || '').replace(/^#/, '');
  if (TABS.includes(h)) return h;
  if (TABS.includes(stored)) return stored;
  return 'fins';
}
