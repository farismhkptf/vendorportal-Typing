/**
 * Converts text to proper/title case with smart handling of small words.
 * - Capitalizes first letter of each word
 * - Keeps certain small words lowercase (unless they're the first word)
 * - Handles common abbreviations that should stay uppercase
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

// Words/abbreviations that should stay uppercase
const UPPERCASE_WORDS = new Set([
  'llc', 'l.l.c', 'l.l.c.',
  'uae', 'u.a.e', 'u.a.e.',
  'usa', 'u.s.a', 'u.s.a.',
  'uk', 'u.k', 'u.k.',
  'id', 'eid', 'eida',
  'pro', 'vip',
  'hr', 'it', 'ceo', 'cfo', 'cto', 'coo',
  'fzc', 'fze', 'fz', 'fzco', 'dmcc', 'dso', 'dip', 'difc', 'jlt', 'jvc', 'jvt',
  'ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'xi',
]);

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

  const words = normalized.toLowerCase().split(' ');
  
  return words.map((word, index) => {
    // Skip empty words
    if (!word) return word;
    
    // Check if it's an abbreviation that should be uppercase
    const lowerWord = word.replace(/[.,]/g, '');
    if (UPPERCASE_WORDS.has(lowerWord)) {
      return word.toUpperCase();
    }
    
    // Check if it's a small word (not first word)
    if (index > 0 && SMALL_WORDS.has(lowerWord)) {
      return word;
    }
    
    // Handle hyphenated words
    if (word.includes('-')) {
      return word.split('-').map((part, partIndex) => {
        const lowerPart = part.replace(/[.,]/g, '');
        if (UPPERCASE_WORDS.has(lowerPart)) {
          return part.toUpperCase();
        }
        if (partIndex > 0 && SMALL_WORDS.has(lowerPart)) {
          return part;
        }
        return capitalizeFirst(part);
      }).join('-');
    }
    
    // Handle words with apostrophes (like O'Brien, McDonald's)
    if (word.includes("'")) {
      return word.split("'").map(part => capitalizeFirst(part)).join("'");
    }
    
    // Regular word - capitalize first letter
    return capitalizeFirst(word);
  }).join(' ');
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
