import { getExtension } from '../../detect';
import { outputFileName } from '../../formats';
import { throwIfAborted, type ConversionRequest, type ConversionResult } from '../types';
import { PdfWriter, UNSUPPORTED_GLYPHS_WARNING, hasUnsupportedGlyphs, type FontFamily } from './pdfWriter';

const MONOSPACE_EXTENSIONS = new Set(['log', 'csv', 'json']);

export async function textToPdf(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress, signal } = request;
  onProgress(null, 'Reading text');

  const raw = await file.text();
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  const lines = text.split('\n');
  const family: FontFamily = MONOSPACE_EXTENSIONS.has(getExtension(file.name)) ? 'courier' : 'helvetica';
  const size = family === 'courier' ? 9.5 : 11;
  const lineHeight = size * 1.35;

  const writer = new PdfWriter();
  for (let i = 0; i < lines.length; i++) {
    if (i % 100 === 0) {
      throwIfAborted(signal);
      onProgress(i / lines.length, 'Laying out pages');
    }
    const line = lines[i];
    if (line.trim() === '') {
      writer.ensureSpace(lineHeight);
      writer.space(lineHeight);
    } else {
      writer.writeText(line, { size, family, spacingAfter: 0 });
    }
  }
  writer.addPageNumbers();

  return {
    blob: writer.toBlob(),
    fileName: outputFileName(file.name, 'pdf'),
    warning: hasUnsupportedGlyphs(text) ? UNSUPPORTED_GLYPHS_WARNING : undefined,
  };
}
