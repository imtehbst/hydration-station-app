// "How to play" for each tab, including every optional rule.
export const HELP = {
  fins: { title: '🦈 Fins & Fangs', lines: [
    'You each get a secret character. Take turns asking a yes/no question; cards that don’t fit flip down by themselves.',
    'When you think you know, tap Guess and pick a card. A wrong guess ends your turn.',
    'If the player who went first guesses right, the other player gets one last guess to tie.',
    '<b>🏆 Series:</b> on the start screen, switch to “first to 3” so rematches count towards a series.',
  ] },
  hooked: { title: '🎣 Hooked!', lines: [
    'Hide your sharks in your tank (they can’t touch), then take turns casting into the other tank.',
    'A bite means you cast again; a splash ends your turn. Catch every shark to win.',
    '<b>💥 Salvo:</b> each turn you get one cast per shark you still have, and bites don’t give extra casts.',
  ] },
  eels: { title: '🐍 Snakes & Ladders', lines: [
    'Race from square 1 to the star. Some squares carry you up, others drag you down. You must land exactly on the star — extra steps bounce back.',
    '<b>🎲🎲 Pick a die:</b> roll two dice each turn and choose which one to move by. Each shows where it would land.',
    '<b>⚡ Fast</b> shortens the animations for you only, and 🎨 Theme changes the look for you only.',
  ] },
  ttt: { title: '🐙 Tic Tac Toe', lines: [
    'Sharks against octopuses. Three in a row — across, down or diagonal — wins.',
    '<b>🫧 Vanishing:</b> you only keep three pieces on the board. Placing a fourth pops your oldest one (shown faded), so games can’t end in a draw.',
  ] },
  drop: { title: '🫧 Shark Drop', lines: [
    'Tap a column to drop a piece; it falls to the lowest free square.',
    'Four in a row — across, down or diagonal — wins. If the tank fills up, it’s a draw.',
  ] },
  memory: { title: '🧠 Memory Match', lines: [
    'On your turn, flip two cards. A matching pair is yours and you go again.',
    'A miss stays face up until the other player starts their turn, so you both get a look. Most pairs wins.',
    'Pick 12, 20 or 30 cards on the start screen.',
  ] },
  gofish: { title: '🐟 Go Fish', lines: [
    'There are nine characters with four cards each. Collect all four of a character to make a set; sets are laid down straight away.',
    'On your turn, tap one of your cards to ask the other player for that character. If they have any, they hand over every one and you go again.',
    'If they have none, you “go fish”: you draw a card from the pond. If it’s the character you asked for, you go again.',
    'When all nine sets are made, whoever has more wins. You only ever see your own cards.',
  ] },
  checkers: { title: '🪸 Coral Checkers', lines: [
    'Pieces move one square diagonally forward. Jump over one of the other side’s pieces to take it.',
    'If you can jump, you must. A piece that can jump again keeps jumping.',
    'Reach the far row to be crowned a king, which can move and jump backwards too.',
    'You win when the other side has no pieces left or can’t move. Pieces you can move are ringed in gold.',
  ] },
  nets: { title: '🥅 Fishing Nets', lines: [
    'Take turns drawing one line between two neighbouring dots.',
    'Draw the fourth side of a square and you catch the fish inside — and take another turn.',
    'When every square is closed, whoever caught more fish wins. Try not to draw the third side of a square: that hands it to the other player.',
  ] },
  hang: { title: '🏊 Hangshark', lines: [
    'One player types a secret word; the other guesses it one letter at a time.',
    'Each wrong letter brings the shark closer. Seven misses and the shark wins, which is a point for whoever set the word. Guess it in time and the guesser scores.',
    'You swap roles every round. Against a bot, the bot always chooses the word. On a computer you can type your guesses.',
  ] },
  flood: { title: '🎨 Color Tide', lines: [
    'You own the patch that starts in the bottom-left corner; the other player starts top-right.',
    'On your turn pick a colour. Your whole patch turns that colour and takes in every square of that colour touching it.',
    'You can’t pick your own current colour or the other player’s (those two are crossed out).',
    'The game ends when every square has been taken. Biggest patch wins.',
  ] },
  wordle: { title: '🦷 Sharkle', lines: [
    'Guess the five-letter word in six tries. Teal = right letter, right spot. Gold = right letter, wrong spot.',
    '<b>🐟 Solo:</b> your own run of words, with stats. <b>📅 Daily:</b> one word a day for everyone, with a streak. <b>⚔️ VS friend:</b> race on the same word — fewest guesses wins, and a tie goes to the faster solver.',
    '<b>📖 Any word / 🌊 Sea words</b> chooses where the secret word comes from.',
    '<b>🔥 Hard mode:</b> letters you’ve found must be used in later guesses.',
    '<b>💡 Hint:</b> once per word, reveal one letter. It costs you one of your six guesses.',
  ] },
};
