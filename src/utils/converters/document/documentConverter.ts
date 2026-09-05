import { FORMATS } from '../../formats';
import { ConversionError, type ConversionRequest, type ConversionResult } from '../types';
import { docxToPdf } from './docxToPdf';
import { docxToText } from './docxToText';
import { imageToPdf } from './imageToPdf';
import { pdfToText } from './pdfToText';
import { textToPdf } from './textToPdf';

export async function convertDocument(request: ConversionRequest): Promise<ConversionResult> {
  const { source, target } = request;
  if (FORMATS[source].category === 'image' && target === 'pdf') return imageToPdf(request);
  if (source === 'docx' && target === 'pdf') return docxToPdf(request);
  if (source === 'docx' && target === 'txt') return docxToText(request);
  if (source === 'pdf' && target === 'txt') return pdfToText(request);
  if (source === 'txt' && target === 'pdf') return textToPdf(request);
  throw new ConversionError(`Converting ${FORMATS[source].label} to ${FORMATS[target].label} is not supported.`);
}
