import type { Block } from './htmlToBlocks';

/**
 * Plain text → blocks. With `joinLines`, consecutive lines form one paragraph (good for text
 * extracted from PDFs); without it every line is its own paragraph (faithful to .txt files).
 */
export function textToBlocks(text: string, options: { joinLines?: boolean } = {}): Block[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (options.joinLines) {
    return normalized
      .split(/\n\s*\n/)
      .map((chunk) => chunk.replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean)
      .map((text) => ({ kind: 'paragraph', text }));
  }
  return normalized.split('\n').map((line) => ({ kind: 'paragraph', text: line }));
}

/** Blocks → readable plain text. */
export function blocksToText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case 'heading':
      case 'paragraph':
        parts.push(block.text);
        break;
      case 'list':
        parts.push(block.items.map((item, i) => (block.ordered ? `${i + 1}. ${item}` : `- ${item}`)).join('\n'));
        break;
      case 'table':
        parts.push(block.rows.map((row) => row.join(' | ')).join('\n'));
        break;
      case 'image':
        break;
    }
  }
  return parts.join('\n\n').trim() + '\n';
}
