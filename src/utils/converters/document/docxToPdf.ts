import * as mammoth from 'mammoth';
import { outputFileName } from '../../formats';
import { ConversionError, throwIfAborted, type ConversionRequest, type ConversionResult } from '../types';
import { blocksToPdf } from './blocksToPdf';
import { htmlToBlocks } from './htmlToBlocks';

export async function docxToHtmlFragment(file: File): Promise<string> {
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  } catch (error) {
    throw new ConversionError(
      'Could not read this Word document. It may be corrupted, password-protected, or an old .doc file rather than .docx.',
      String(error),
    );
  }
}

export async function docxToPdf(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress, signal } = request;
  onProgress(null, 'Reading document');
  const html = await docxToHtmlFragment(file);
  throwIfAborted(signal);
  const { blob, warning } = await blocksToPdf(htmlToBlocks(html), onProgress, signal);
  return { blob, fileName: outputFileName(file.name, 'pdf'), warning };
}
