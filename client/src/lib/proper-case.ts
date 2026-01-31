/**
 * Converts text to proper/title case with smart handling of small words.
 * - Capitalizes first letter of each word
 * - Keeps certain small words lowercase (unless they're the first word)
 * - Handles common abbreviations that should stay uppercase with dots (L.L.C., U.A.E., etc.)
 */

// Words that should remain lowercase (unless first word)
const SMALL_WORDS = new Set([
  'a', 'an', 'the',           // Articles
  'and', 'but', 'or', 'nor',  // Conjunctions
  'for', 'so', 'yet',         // Conjunctions
  'at', 'by', 'in', 'of',     // Prepositions
  'on', 'to', 'up', 'as',     // Prepositions
  'from', 'into', 'onto',     // Prepositions
  'with', 'over', 'upon',     // Prepositions
  'via', 'per',               // Latin prepositions
  'vs', 'vs.',                // Versus
]);

// Abbreviation mappings: normalized form (lowercase, no dots) -> dotted format
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
  // Roman numerals stay as-is (no dots)
  'ii': 'II',
  'iii': 'III',
  'iv': 'IV',
  'vi': 'VI',
  'vii': 'VII',
  'viii': 'VIII',
  'ix': 'IX',
  'xi': 'XI',
};

/**
 * Normalizes an abbreviation by removing dots and converting to lowercase
 */
function normalizeAbbreviation(word: string): string {
  return word.replace(/\./g, '').toLowerCase();
}

/**
 * Converts a string to proper case (title case with smart word handling)
 * @param text - The input text to convert
 * @returns The text in proper case
 */
export function toProperCase(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Trim and normalize whitespace
  const normalized = text.trim().replace(/\s+/g, ' ');
  
  if (!normalized) {
    return '';
  }

  const words = normalized.split(' ');
  
  return words.map((word, index) => {
    // Skip empty words
    if (!word) return word;
    
    // Handle hyphenated words (like FZ-LLC -> F.Z.-L.L.C.)
    if (word.includes('-')) {
      return word.split('-').map((part, partIndex) => {
        return processWord(part, index === 0 && partIndex === 0);
      }).join('-');
    }
    
    return processWord(word, index === 0);
  }).join(' ');
}

/**
 * Process a single word for proper casing
 */
function processWord(word: string, isFirst: boolean): string {
  if (!word) return word;
  
  // Normalize the word (remove dots, lowercase) for lookup
  const normalizedWord = normalizeAbbreviation(word);
  
  // Check if it's a known abbreviation
  if (ABBREVIATION_MAP[normalizedWord]) {
    return ABBREVIATION_MAP[normalizedWord];
  }
  
  // Check if it's a small word (not first word)
  if (!isFirst && SMALL_WORDS.has(normalizedWord)) {
    return word.toLowerCase();
  }
  
  // Handle words with apostrophes (like O'Brien, McDonald's)
  if (word.includes("'")) {
    return word.toLowerCase().split("'").map(part => capitalizeFirst(part)).join("'");
  }
  
  // Regular word - capitalize first letter
  return capitalizeFirst(word.toLowerCase());
}

/**
 * Capitalizes the first letter of a word
 */
function capitalizeFirst(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * React hook-compatible handler for applying proper case on blur
 * Use this with onBlur events on input fields
 */
export function createProperCaseHandler(
  setValue: (value: string) => void
): (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void {
  return (event) => {
    const value = event.target.value;
    if (value) {
      setValue(toProperCase(value));
    }
  };
}
