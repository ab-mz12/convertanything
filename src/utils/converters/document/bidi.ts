/**
 * Right-to-left support for PDF output. jsPDF draws glyphs strictly left to right, so text that
 * contains Arabic (or Hebrew) must be reordered into *visual* order first, and Arabic letters must
 * be replaced by their contextual (initial/medial/final/isolated) presentation forms.
 */
import bidiFactory from 'bidi-js';

export type Direction = 'ltr' | 'rtl';

const bidi = bidiFactory();

const RTL_CHARS = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const STRONG = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]|[֐-ࣿיִ-﷿ﹰ-﻿]/;

export function hasRtlText(text: string): boolean {
  return RTL_CHARS.test(text);
}

/** Base direction of a paragraph: that of its first strongly directional character. */
export function paragraphDirection(text: string): Direction {
  const match = STRONG.exec(text);
  return match && RTL_CHARS.test(match[0]) ? 'rtl' : 'ltr';
}

/** Reorder a single (already wrapped) line from logical to visual order, mirroring brackets. */
export function toVisualOrder(line: string, direction: Direction): string {
  if (!hasRtlText(line) && direction === 'ltr') return line;
  const levels = bidi.getEmbeddingLevels(line, direction);
  const chars = line.split('');
  // Brackets and the like flip to their mirrored glyph when they sit in a right-to-left run.
  for (let i = 0; i < chars.length; i++) {
    if (levels.levels[i] & 1) {
      const mirrored = bidi.getMirroredCharacter(chars[i]);
      if (mirrored) chars[i] = mirrored;
    }
  }
  for (const [start, end] of bidi.getReorderSegments(line, levels)) {
    let i = start;
    let j = end;
    while (i < j) {
      const tmp = chars[i];
      chars[i] = chars[j];
      chars[j] = tmp;
      i++;
      j--;
    }
  }
  return chars.join('');
}
