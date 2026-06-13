import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..', '..');

function extractQuotedWords(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return [...text.matchAll(/'([a-z]{3,8})'/gi)].map(m => m[1].toLowerCase());
}

function extractSetWords(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return [...text.matchAll(/"([a-z]{3,8})"/gi)].map(m => m[1].toLowerCase());
}

function loadGoogle10k() {
  const file = path.join(dir, 'google-10000-english.txt');
  return fs.readFileSync(file, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length >= 3 && w.length <= 8 && /^[a-z]+$/.test(w));
}

const fromGames = [
  ...extractQuotedWords(path.join(root, 'games', 'wordtrap', 'index.html')),
  ...extractSetWords(path.join(root, 'games', 'neonsearch', 'index.html')),
];

const google10k = loadGoogle10k();

// Extra everyday / game-friendly words not always in the Google 10k slice
const EXTRA = `
arcade binary button coding cyber desert dragon energy finish galaxy hidden laptop matrix orange portal rocket script server sunset tennis vector winter wonder
triangle notebook keyboard gameplay learning painters champion sunshine mountain elephant planning cleaning graphics terminal reaction training portable cookbook meetings monitors printers wordgame readings friendly holidays birthday sandwich baseball football swimming creation dolphins gardener marketed trailers goldmine streamed wondered standard wordplay breakout playtime teaching students builders painting goldfish handmade bookmark broadcast framework highlight inventory landscape timeline viewport workspace chocolate blueberry pineapple astronaut telescope waterfall fortress cathedral discovery navigation adventure encryption algorithm interface developer processor paragraph migration collision direction ecosystem architect animation bandwidth challenge character configure copyright dashboard detective dimension emergency executive explosion extension furniture geography happiness household important influence inspector integrity interview invention librarian limestone machinery marketing mechanic medieval memorable microphone millennium miniature momentum monument mushroom narrative navigator operation orchestra organizer overnight ownership passenger performer permanent physician placement pollution portfolio potential practical precision president primitive principal privilege procedure professor programme projector promotion prototype provision publisher radiation recommend reference regulate reluctant remainder renewable reporter represent residence resources response restraint retrieval revolution satellite scientist secondary secretary sensation sensitive situation skeleton snowflake sociology software solution southern sparkling specialty spectacle spiritual spotlight stability statement strategic structure submarine substance sunflower supervise supporter surprised suspicion sweater sympathy symphony technical telephone temporary territory testimony textbook therapist thickness thousand threshold throughout tolerance touchdown tradition transform translate transport treasurer treatment tremendous ultimate umbrella undertake universal universe unusual upstairs vacation valuable variable vegetable velocity vertical viewpoint virtually visibility visiting vitamin vocabulary wandering warehouse warrior weather wedding welcome wonderful woodland workforce workshop worldwide wireless typewriter backstage clockwork crossword handshake jellyfish moonlight tabletop windmill yearbook
emoji inbox wifi meme vibe podcast vlog streamer upload download browser desktop toolbar sidebar podcast
`.trim().split(/\s+/);

const LETTER_SEEDS = [
  'TRIANGLE', 'NOTEBOOK', 'KEYBOARD', 'GAMEPLAY', 'LEARNING', 'PAINTERS', 'CHAMPION',
  'SUNSHINE', 'MOUNTAIN', 'ELEPHANT', 'PLANNING', 'CLEANING', 'GRAPHICS', 'TERMINAL',
  'REACTION', 'TRAINING', 'PORTABLE', 'COOKBOOK', 'MEETINGS', 'MONITORS', 'PRINTERS',
  'WORDGAME', 'READINGS', 'FRIENDLY', 'HOLIDAYS', 'BIRTHDAY', 'SANDWICH',
  'BASEBALL', 'FOOTBALL', 'SWIMMING', 'CREATION', 'DOLPHINS', 'GARDENER', 'MARKETED',
  'TRAILERS', 'GOLDMINE', 'STREAMED', 'WONDERED', 'STANDARD', 'WORDPLAY',
  'BREAKOUT', 'PLAYTIME', 'TEACHING', 'STUDENTS', 'BUILDERS', 'PAINTING',
  'GOLDFISH', 'HANDMADE', 'FORESTED', 'CREATORS', 'ARCADEGO', 'DESKWORK',
];

function basicWord(word) {
  if (word.length < 3 || word.length > 8) return false;
  if (!/^[a-z]+$/.test(word)) return false;
  if (!/[aeiou]/.test(word)) return false;
  if (/(.)\1\1/.test(word)) return false;
  if (/[^aeiou]{5,}/.test(word)) return false;
  return true;
}

function canBuild(word, letters) {
  const a = {};
  letters.forEach(l => { a[l] = (a[l] || 0) + 1; });
  for (const c of word.toUpperCase()) {
    if (!a[c]) return false;
    a[c]--;
  }
  return true;
}

const merged = [...new Set([
  ...google10k,
  ...fromGames,
  ...EXTRA,
])]
  .map(w => w.trim().toLowerCase())
  .filter(basicWord)
  .sort();

const out = `// Common words for Word Forge (3-8 letters) — Google 10k + game banks + extras\nwindow.forgeWords = ${JSON.stringify(merged)};\n`;
fs.writeFileSync(path.join(dir, 'common-words.js'), out);
console.log('merged', merged.length, 'words');
console.log('sources:', { google10k: google10k.length, fromGames: fromGames.length, extra: EXTRA.length });

['TRIANGLE', 'NOTEBOOK', 'KEYBOARD', 'GAMEPLAY', 'WORDPLAY', 'SUNSHINE', 'MOUNTAIN', 'ELEPHANT'].forEach(seed => {
  const poss = merged.filter(w => canBuild(w, seed.split('')));
  console.log(seed, poss.length, 'possible');
});
