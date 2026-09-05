import { throwIfAborted, type ProgressCallback } from '../types';
import type { Block } from './htmlToBlocks';
import { PdfWriter, UNSUPPORTED_GLYPHS_WARNING, hasUnsupportedGlyphs, loadImageSource } from './pdfWriter';

const HEADING_SIZES = [22, 17, 14, 12.5, 11.5, 11];

/** Lay out a list of blocks (from DOCX or HTML) as an A4 PDF. */
export async function blocksToPdf(
  blocks: Block[],
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<{ blob: Blob; warning?: string }> {
  const writer = new PdfWriter();
  const total = Math.max(blocks.length, 1);
  let sawUnsupportedGlyphs = false;
  const check = (text: string): string => {
    if (!sawUnsupportedGlyphs && hasUnsupportedGlyphs(text)) sawUnsupportedGlyphs = true;
    return text;
  };

  for (let i = 0; i < blocks.length; i++) {
    throwIfAborted(signal);
    await renderBlock(writer, blocks[i], i === 0, check);
    onProgress(0.2 + 0.75 * ((i + 1) / total), 'Laying out pages');
  }
  if (blocks.length === 0) {
    writer.writeText('(This document contains no readable text.)', { style: 'italic', color: '#6b7280' });
  }
  writer.addPageNumbers();
  return { blob: writer.toBlob(), warning: sawUnsupportedGlyphs ? UNSUPPORTED_GLYPHS_WARNING : undefined };
}

async function renderBlock(writer: PdfWriter, block: Block, first: boolean, check: (t: string) => string): Promise<void> {
  switch (block.kind) {
    case 'heading': {
      if (!first) writer.space(6);
      writer.writeText(check(block.text), { size: HEADING_SIZES[block.level - 1] ?? 11, style: 'bold', spacingAfter: 6 });
      return;
    }
    case 'paragraph':
      writer.writeText(check(block.text), { size: 11, spacingAfter: 7 });
      return;
    case 'list':
      block.items.forEach((item, index) =>
        writer.writeListItem(check(item), block.ordered ? `${index + 1}.` : '•', { indent: 10 }),
      );
      writer.space(5);
      return;
    case 'table':
      block.rows.forEach((row) => row.forEach(check));
      writer.writeTable(block.rows);
      return;
    case 'image': {
      const image = await loadImageSource(block.src);
      if (image) writer.writeImage(image);
      else writer.writeText('[image could not be rendered]', { size: 9, style: 'italic', color: '#9ca3af', spacingAfter: 6 });
      return;
    }
  }
}
