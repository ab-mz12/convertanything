import * as pdfjs from 'pdfjs-dist';
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { outputFileName } from '../../formats';
import { ConversionError, throwIfAborted, type ConversionRequest, type ConversionResult, type ProgressCallback } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Rebuild readable lines from pdf.js text items. Items on the same baseline are joined (adding a
 * space when there is a visible gap); a change in baseline starts a new line.
 */
export function textItemsToString(items: Array<TextItem | TextMarkedContent>): string {
  let out = '';
  let lastEndX: number | null = null;
  let lastY: number | null = null;
  let lastEndedWithSpace = true;

  for (const item of items) {
    if (!('str' in item)) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const newLine = lastY !== null && Math.abs(y - lastY) > 2;
    if (newLine) {
      if (!out.endsWith('\n')) out += '\n';
    } else if (
      lastEndX !== null &&
      item.str &&
      x - lastEndX > 1.5 &&
      !lastEndedWithSpace &&
      !item.str.startsWith(' ') &&
      !out.endsWith('\n')
    ) {
      out += ' ';
    }
    out += item.str;
    if (item.hasEOL) out += '\n';
    lastEndX = x + item.width;
    lastY = y;
    lastEndedWithSpace = item.hasEOL || /\s$/.test(item.str);
  }
  return out.replace(/[ \t]+\n/g, '\n').trim();
}

/** Open a PDF with pdf.js, translating its errors into user-facing messages. */
export async function openPdf(file: File): Promise<pdfjs.PDFDocumentProxy> {
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === 'PasswordException') {
      throw new ConversionError('This PDF is password-protected. Remove the password and try again.');
    }
    if (name === 'InvalidPDFException') {
      throw new ConversionError('This file is not a valid PDF or is corrupted.');
    }
    throw new ConversionError('Could not open this PDF.', String(error));
  }
}

const NO_TEXT_WARNING = 'No text layer was found. This PDF is probably made of scanned images; OCR is not supported.';

/** Extract the text layer of every page. */
export async function extractPdfText(
  file: File,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<{ text: string; warning?: string }> {
  onProgress(null, 'Opening PDF');
  const pdf = await openPdf(file);
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      throwIfAborted(signal);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(textItemsToString(content.items));
      page.cleanup();
      onProgress(pageNumber / pdf.numPages, `Extracting text · page ${pageNumber} of ${pdf.numPages}`);
    }
  } finally {
    await pdf.destroy();
  }

  const text = pages.join('\n\n').trim();
  return { text, warning: text ? undefined : NO_TEXT_WARNING };
}

export async function pdfToText(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress, signal } = request;
  const { text, warning } = await extractPdfText(file, onProgress, signal);
  return {
    blob: new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' }),
    fileName: outputFileName(file.name, 'txt'),
    warning,
  };
}
