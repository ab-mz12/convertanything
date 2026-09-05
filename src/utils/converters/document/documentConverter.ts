import { FORMATS } from '../../formats';
import { ConversionError, type ConversionRequest, type ConversionResult } from '../types';
import { docxToHtml } from './docxToHtml';
import { docxToPdf } from './docxToPdf';
import { docxToText } from './docxToText';
import { htmlToDocx, htmlToPdf, htmlToText, textToHtml } from './htmlConverters';
import { imageToPdf } from './imageToPdf';
import { pdfToImages } from './pdfToImages';
import { pdfToText } from './pdfToText';
import { textToPdf } from './textToPdf';
import { pdfToDocx, textToDocx } from './toDocx';

export async function convertDocument(request: ConversionRequest): Promise<ConversionResult> {
  const { source, target } = request;
  if (FORMATS[source].category === 'image' && target === 'pdf') return imageToPdf(request);
  const pair = `${source}>${target}`;
  switch (pair) {
    case 'docx>pdf':
      return docxToPdf(request);
    case 'docx>txt':
      return docxToText(request);
    case 'docx>html':
      return docxToHtml(request);
    case 'pdf>txt':
      return pdfToText(request);
    case 'pdf>docx':
      return pdfToDocx(request);
    case 'pdf>png':
      return pdfToImages(request, 'png');
    case 'pdf>jpg':
      return pdfToImages(request, 'jpg');
    case 'txt>pdf':
      return textToPdf(request);
    case 'txt>docx':
      return textToDocx(request);
    case 'txt>html':
      return textToHtml(request);
    case 'html>pdf':
      return htmlToPdf(request);
    case 'html>txt':
      return htmlToText(request);
    case 'html>docx':
      return htmlToDocx(request);
    default:
      throw new ConversionError(`Converting ${FORMATS[source].label} to ${FORMATS[target].label} is not supported.`);
  }
}
