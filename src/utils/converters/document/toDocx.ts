import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { outputFileName } from '../../formats';
import { throwIfAborted, type ConversionRequest, type ConversionResult } from '../types';
import type { Block } from './htmlToBlocks';
import { extractPdfText } from './pdfToText';
import { textToBlocks } from './textBlocks';

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

/** Build a .docx from layout blocks using the `docx` library. */
export async function blocksToDocx(blocks: Block[], title: string): Promise<Blob> {
  const children: Array<Paragraph | Table> = [];
  for (const block of blocks) {
    switch (block.kind) {
      case 'heading':
        children.push(new Paragraph({ text: block.text, heading: HEADINGS[block.level - 1] ?? HeadingLevel.HEADING_6 }));
        break;
      case 'paragraph':
        children.push(new Paragraph({ children: [new TextRun(block.text)], spacing: { after: 120 } }));
        break;
      case 'list':
        block.items.forEach((item, index) =>
          children.push(
            block.ordered
              ? new Paragraph({ children: [new TextRun(`${index + 1}. ${item}`)], indent: { left: 360 }, spacing: { after: 60 } })
              : new Paragraph({ children: [new TextRun(item)], bullet: { level: 0 }, spacing: { after: 60 } }),
          ),
        );
        break;
      case 'table': {
        const columns = Math.max(1, ...block.rows.map((row) => row.length));
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: block.rows.map(
              (row) =>
                new TableRow({
                  children: Array.from({ length: columns }, (_, i) => new TableCell({ children: [new Paragraph(row[i] ?? '')] })),
                }),
            ),
          }),
        );
        children.push(new Paragraph(''));
        break;
      }
      case 'image':
        children.push(new Paragraph({ children: [new TextRun({ text: '[image]', italics: true, color: '888888' })] }));
        break;
    }
  }
  if (children.length === 0) children.push(new Paragraph(''));
  const document = new Document({ title, sections: [{ children }] });
  return Packer.toBlob(document);
}

export async function textToDocx(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress } = request;
  onProgress(null, 'Building document');
  const blob = await blocksToDocx(textToBlocks(await file.text()), file.name);
  return { blob, fileName: outputFileName(file.name, 'docx') };
}

export async function pdfToDocx(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress, signal } = request;
  const { text, warning } = await extractPdfText(file, onProgress, signal);
  throwIfAborted(signal);
  onProgress(0.9, 'Building document');
  const blob = await blocksToDocx(textToBlocks(text, { joinLines: true }), file.name);
  return {
    blob,
    fileName: outputFileName(file.name, 'docx'),
    warning: warning ?? 'Text only: the original layout, fonts and images are not preserved.',
  };
}
