import { outputFileName } from '../../formats';
import type { ConversionRequest, ConversionResult } from '../types';
import { docxToHtmlFragment } from './docxToPdf';
import { titleFromFileName, wrapHtmlPage } from './htmlPage';

export async function docxToHtml(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress } = request;
  onProgress(null, 'Reading document');
  const fragment = await docxToHtmlFragment(file);
  const page = wrapHtmlPage(titleFromFileName(file.name), fragment);
  return { blob: new Blob([page], { type: 'text/html;charset=utf-8' }), fileName: outputFileName(file.name, 'html') };
}
