/**
 * GSM-7 transliteration utility.
 *
 * Converts text to GSM-7 compatible characters by:
 * 1. Transliterating known diacritics and special chars
 * 2. Replacing curly quotes/apostrophes with straight equivalents
 * 3. Replacing em/en dashes with hyphens
 * 4. Replacing ellipsis with three dots
 * 5. Stripping any remaining non-GSM-7 characters
 */

// GSM 03.38 Basic Character Set
const GSM7_BASIC_CHARSET = new Set<string>([
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç',
  'Ø', 'ø', 'Å', 'å', 'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω',
  'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', 'Æ', 'æ', 'ß', 'É',
  ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')',
  '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ':', ';', '<', '=', '>', '?', '¡',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
  'Ä', 'Ö', 'Ñ', 'Ü', '§', '¿',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
  'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
  'u', 'v', 'w', 'x', 'y', 'z',
  'ä', 'ö', 'ñ', 'ü', 'à',
  '\n', '\r',
]);

// GSM 03.38 Extension Table
const GSM7_EXTENSION_CHARSET = new Set<string>([
  '^', '{', '}', '[', ']', '~', '|', '€', '\\',
]);

// Transliteration map: source char → replacement
const TRANSLITERATION_MAP: Record<string, string> = {
  // Romanian diacritics
  'ă': 'a', 'Ă': 'A',
  'î': 'i', 'Î': 'I',
  'â': 'a', 'Â': 'A',
  'ș': 's', 'Ș': 'S',
  'ț': 't', 'Ț': 'T',
  // Legacy Romanian cedilla variants (ş/Ş/ţ/Ţ)
  'ş': 's', 'Ş': 'S',
  'ţ': 't', 'Ţ': 'T',

  // Common accented Latin characters (not already in GSM-7)
  'ê': 'e', 'ë': 'e',
  'û': 'u', 'ú': 'u',
  'ï': 'i', 'í': 'i',
  'ô': 'o', 'ó': 'o', 'õ': 'o',
  'á': 'a', 'ã': 'a',
  'ç': 'c',
  'ý': 'y', 'ÿ': 'y',
  'ń': 'n',
  'ś': 's', 'š': 's',
  'ź': 'z', 'ž': 'z', 'ż': 'z',
  'ć': 'c', 'č': 'c',
  'ř': 'r',
  'ď': 'd', 'ð': 'd',
  'ľ': 'l', 'ł': 'l',
  'ě': 'e',
  'ů': 'u',
  'ğ': 'g',
  'ı': 'i',
  // Uppercase accented
  'Ê': 'E', 'Ë': 'E',
  'Û': 'U', 'Ú': 'U',
  'Ï': 'I', 'Í': 'I',
  'Ô': 'O', 'Ó': 'O', 'Õ': 'O',
  'Á': 'A', 'Ã': 'A',
  'Ý': 'Y',
  'Ń': 'N',
  'Ś': 'S', 'Š': 'S',
  'Ź': 'Z', 'Ž': 'Z', 'Ż': 'Z',
  'Ć': 'C', 'Č': 'C',
  'Ř': 'R',
  'Ď': 'D', 'Ð': 'D',
  'Ľ': 'L', 'Ł': 'L',
  'Ě': 'E',
  'Ů': 'U',
  'Ğ': 'G',
  'İ': 'I',

  // Curly quotes → straight
  '\u201C': '"', // "
  '\u201D': '"', // "
  '\u2018': "'", // '
  '\u2019': "'", // '

  // Dashes
  '\u2014': '-', // em dash —
  '\u2013': '-', // en dash –

  // Ellipsis
  '\u2026': '...', // …
};

function isGsm7Char(ch: string): boolean {
  return GSM7_BASIC_CHARSET.has(ch) || GSM7_EXTENSION_CHARSET.has(ch);
}

/**
 * Transliterate text to GSM-7 compatible characters.
 * Characters that can't be transliterated and aren't in GSM-7 are stripped.
 */
export function forceGsm7(text: string): string {
  let result = '';
  for (const ch of text) {
    if (isGsm7Char(ch)) {
      result += ch;
    } else if (ch in TRANSLITERATION_MAP) {
      result += TRANSLITERATION_MAP[ch];
    } else {
      // Strip non-GSM-7 character
    }
  }
  return result;
}
