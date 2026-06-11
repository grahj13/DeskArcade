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

const fromGames = [
  ...extractQuotedWords(path.join(root, 'games', 'wordtrap', 'index.html')),
  ...extractSetWords(path.join(root, 'games', 'neonsearch', 'index.html')),
];

const LONG_WORDS = `triangle notebook keyboard gameplay learning painters champion sunshine mountain elephant planning cleaning graphics terminal reaction training portable cookbook meetings monitors printers wordgame readings friendly holidays birthday sandwich baseball football swimming creation dolphins gardener marketed trailers goldmine streamed wondered standard wordplay breakout playtime teaching students builders painting goldfish handmade javascript bookmark broadcast framework highlight inventory landscape timeline viewport workspace chocolate blueberry pineapple astronaut telescope waterfall fortress cathedral discovery navigation adventure encryption algorithm interface developer processor paragraph migration collision direction ecosystem architect animation bandwidth challenge character configure copyright dashboard detective dimension emergency executive explosion extension furniture geography happiness household important influence inspector integrity interview invention librarian limestone machinery marketing mechanic medieval memorable microphone millennium miniature momentum monument mushroom narrative navigator operation orchestra organizer overnight ownership passenger performer permanent physician placement pollution portfolio potential practical precision president primitive principal privilege procedure professor programme projector promotion prototype provision publisher radiation recommend reference regulate reluctant remainder renewable reporter represent residence resources response restraint retrieval revolution satellite scientist secondary secretary sensation sensitive situation skeleton snowflake sociology software solution southern sparkling specialty spectacle spiritual spotlight stability statement strategic structure submarine substance sunflower supervise supporter surprised suspicion sweater sympathy symphony technical telephone temporary territory testimony textbook therapist thickness thousand threshold throughout tolerance touchdown tradition transform translate transport treasurer treatment tremendous ultimate umbrella undertake universal universe unusual upstairs vacation valuable variable vegetable velocity vertical viewpoint virtually visibility visiting vitamin vocabulary wandering warehouse warrior weather wedding welcome wonderful woodland workforce workshop worldwide wireless typewriter backstage clockwork crossword handshake jellyfish moonlight tabletop windmill yearbook`.split(/\s+/);

const dictSrc = fs.readFileSync(path.join(dir, 'dictionary.js'), 'utf8');
const fullDict = eval(dictSrc.match(/window\.dictionary\s*=\s*(\[[\s\S]*\])/)[1]);

const commonLetters = new Set('etaoinshrdlcumwfgypb'.split(''));

function base(word) {
  if (word.length < 3 || word.length > 8) return false;
  if (!/^[a-z]+$/.test(word)) return false;
  if (!/[aeiou]/.test(word)) return false;
  if (/(.)\1\1/.test(word)) return false;
  if (/[^aeiou]{4,}/.test(word)) return false;
  if (/^(aa|ah|eh|uh|uu|ii|ae|oe|eu)/.test(word)) return false;
  return true;
}

function isShortForgeWord(word) {
  if (!base(word) || word.length > 4) return false;
  if (![...word].every(ch => commonLetters.has(ch))) return false;
  const vowels = (word.match(/[aeiou]/g) || []).length;
  if (word.length >= 4 && vowels < 2 && /[bcdfghjklmnpqrstvwxyz]{3,}/.test(word)) return false;
  return true;
}

const shortFiltered = fullDict.map(w => String(w).trim().toLowerCase()).filter(isShortForgeWord);
const fiveFromGames = fromGames.filter(w => w.length === 5);

const merged = [...new Set([
  ...fromGames,
  ...shortFiltered,
  ...fiveFromGames,
  ...LONG_WORDS
])]
  .filter(w => w.length >= 3 && w.length <= 8 && /^[a-z]+$/.test(w))
  .sort();

const out = `// Curated common words for Word Forge (3-8 letters)\nwindow.forgeWords = ${JSON.stringify(merged)};\n`;
fs.writeFileSync(path.join(dir, 'common-words.js'), out);
console.log('fromGames', fromGames.length, 'short', shortFiltered.length, 'merged', merged.length);

function canBuild(word, letters) {
  const a = {};
  letters.forEach(l => { a[l] = (a[l] || 0) + 1; });
  for (const c of word.toUpperCase()) {
    if (!a[c]) return false;
    a[c]--;
  }
  return true;
}

['TRIANGLE', 'NOTEBOOK', 'KEYBOARD', 'GAMEPLAY', 'LEARNING', 'WORDPLAY'].forEach(seed => {
  const poss = merged.filter(w => canBuild(w, seed.split('')));
  console.log(seed, poss.length);
});
