/**
 * Decides which converter implementation handles a given source → target pair.
 *
 *  - image     Canvas / OffscreenCanvas in a Web Worker (+ small WASM codec for AVIF)
 *  - document  mammoth, pdf.js and jsPDF
 *  - media     ffmpeg.wasm (lazy-loaded)
 */
import { FORMATS, isValidConversion, type FormatId } from './formats';

export type ConverterKind = 'image' | 'document' | 'media';

export function getConverterKind(source: FormatId, target: FormatId): ConverterKind | undefined {
  if (!isValidConversion(source, target)) return undefined;
  const category = FORMATS[source].category;
  if (category === 'video' || category === 'audio') return 'media';
  if (category === 'image') return target === 'pdf' ? 'document' : 'image';
  return 'document';
}

/** Whether a conversion needs the (large, lazily loaded) FFmpeg engine. */
export function needsFFmpeg(source: FormatId, target: FormatId): boolean {
  return getConverterKind(source, target) === 'media';
}
