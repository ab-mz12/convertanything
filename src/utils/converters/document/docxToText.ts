import * as mammoth from 'mammoth';
import { outputFileName } from '../../formats';
import { ConversionError, type ConversionRequest, type ConversionResult } from '../types';

export async function docxToText(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress } = request;
  onProgress(null, 'Extracting text');
  let text: string;
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } catch (error) {
    throw new ConversionError(
      'Could not read this Word document. It may be corrupted, password-protected, or an old .doc file rather than .docx.',
      String(error),
    );
  }
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return {
    blob: new Blob([normalized + '\n'], { type: 'text/plain;charset=utf-8' }),
    fileName: outputFileName(file.name, 'txt'),
    warning: normalized ? undefined : 'The document did not contain any text.',
  };
}
