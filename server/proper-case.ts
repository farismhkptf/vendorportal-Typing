/**
 * Converts text to proper/title case with smart handling of small words.
 * - Capitalizes first letter of each word
 * - Keeps certain small words lowercase (unless they're the first word)
 * - Handles common abbreviations that should stay uppercase with dots (L.L.C., U.A.E., etc.)
 */

const SMALL_WORDS = new Set([
  'a', 'an', 'the',
  'and', 'but', 'or', 'nor',
  'for', 'so', 'yet',
  'at', 'by', 'in', 'of',
  'on', 'to', 'up', 'as',
  'from', 'into', 'onto',
  'with', 'over', 'upon',
  'via', 'per',
  'vs', 'vs.',
]);

const ABBREVIATION_MAP: Record<string, string> = {
  'llc': 'L.L.C.',
  'uae': 'U.A.E.',
  'usa': 'U.S.A.',
  'uk': 'U.K.',
  'id': 'I.D.',
  'eid': 'E.I.D.',
  'eida': 'E.I.D.A.',
  'pro': 'P.R.O.',
  'vip': 'V.I.P.',
  'hr': 'H.R.',
  'it': 'I.T.',
  'ceo': 'C.E.O.',
  'cfo': 'C.F.O.',
  'cto': 'C.T.O.',
  'coo': 'C.O.O.',
  'fzc': 'F.Z.C.',
  'fze': 'F.Z.E.',
  'fz': 'F.Z.',
  'fzco': 'F.Z.C.O.',
  'dmcc': 'D.M.C.C.',
  'dso': 'D.S.O.',
  'dip': 'D.I.P.',
  'difc': 'D.I.F.C.',
  'jlt': 'J.L.T.',
  'jvc': 'J.V.C.',
  'jvt': 'J.V.T.',
  'ii': 'II',
  'iii': 'III',
  'iv': 'IV',
  'vi': 'VI',
  'vii': 'VII',
  'viii': 'VIII',
  'ix': 'IX',
  'xi': 'XI',
};

function normalizeAbbreviation(word: string): string {
  return word.replace(/\./g, '').toLowerCase();
}

function capitalizeFirst(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function processWord(word: string, isFirst: boolean): string {
  if (!word) return word;
  
  const normalizedWord = normalizeAbbreviation(word);
  
  if (ABBREVIATION_MAP[normalizedWord]) {
    return ABBREVIATION_MAP[normalizedWord];
  }
  
  if (!isFirst && SMALL_WORDS.has(normalizedWord)) {
    return word.toLowerCase();
  }
  
  if (word.includes("'")) {
    return word.toLowerCase().split("'").map(part => capitalizeFirst(part)).join("'");
  }
  
  return capitalizeFirst(word.toLowerCase());
}

export function toProperCase(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  const normalized = text.trim().replace(/\s+/g, ' ');
  
  if (!normalized) {
    return '';
  }

  const words = normalized.split(' ');
  
  return words.map((word, index) => {
    if (!word) return word;
    
    if (word.includes('-')) {
      return word.split('-').map((part, partIndex) => {
        return processWord(part, index === 0 && partIndex === 0);
      }).join('-');
    }
    
    return processWord(word, index === 0);
  }).join(' ');
}
