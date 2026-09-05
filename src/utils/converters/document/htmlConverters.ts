import { outputFileName } from '../../formats';
import { throwIfAborted, type ConversionRequest, type ConversionResult } from '../types';
import { blocksToPdf } from './blocksToPdf';
import { htmlToBlocks } from './htmlToBlocks';
import { escapeHtml, titleFromFileName, wrapHtmlPage } from './htmlPage';
import { blocksToText } from './textBlocks';
import { blocksToDocx } from './toDocx';

const HTML_WARNING = 'Page styling and remote images are not carried over; only the text structure (headings, lists, tables, inline images) is.';

export async function htmlToPdf(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress, signal } = request;
  onProgress(null, 'Reading page');
  const blocks = htmlToBlocks(await file.text());
  throwIfAborted(signal);
  const { blob, warning } = await blocksToPdf(blocks, onProgress, signal);
  return { blob, fileName: outputFileName(file.name, 'pdf'), warning: warning ?? HTML_WARNING };
}

export async function htmlToText(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress } = request;
  onProgress(null, 'Extracting text');
  const text = blocksToText(htmlToBlocks(await file.text()));
  return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), fileName: outputFileName(file.name, 'txt') };
}

export async function htmlToDocx(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress } = request;
  onProgress(null, 'Building document');
  const blob = await blocksToDocx(htmlToBlocks(await file.text()), titleFromFileName(file.name));
  return { blob, fileName: outputFileName(file.name, 'docx'), warning: HTML_WARNING };
}

export async function textToHtml(request: ConversionRequest): Promise<ConversionResult> {
  const { file, onProgress } = request;
  onProgress(null, 'Building page');
  const text = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, '<br>\n')}</p>`)
    .join('\n');
  const page = wrapHtmlPage(titleFromFileName(file.name), paragraphs || '<p></p>');
  return { blob: new Blob([page], { type: 'text/html;charset=utf-8' }), fileName: outputFileName(file.name, 'html') };
}
