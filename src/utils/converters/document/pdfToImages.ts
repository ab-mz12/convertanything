import { mimeFor, outputFileName, type FormatId } from '../../formats';
import { uniqueFileNames } from '../../download';
import { ConversionError, throwIfAborted, type ConversionRequest, type ConversionResult } from '../types';
import { openPdf } from './pdfToText';

/** Roughly 200 DPI for an A4 page. */
const MAX_RENDER_WIDTH = 1700;

/**
 * Render every page to an image. A single page becomes one image file; several pages are bundled
 * into a ZIP (one file per page) because a conversion produces exactly one download.
 */
export async function pdfToImages(request: ConversionRequest, target: 'png' | 'jpg'): Promise<ConversionResult> {
  const { file, onProgress, signal, options } = request;
  const pdf = await openPdf(file);
  const pages: Blob[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      throwIfAborted(signal);
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, MAX_RENDER_WIDTH / base.width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new ConversionError('Could not create a drawing context.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      // 'print' intent renders without waiting for animation frames, so the conversion keeps
      // going even when the tab is in the background.
      await page.render({ canvas, canvasContext: context, viewport, intent: 'print' }).promise;
      page.cleanup();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('canvas.toBlob returned null'))),
          mimeFor(target),
          target === 'jpg' ? options.imageQuality : undefined,
        ),
      );
      pages.push(blob);
      onProgress(pageNumber / pdf.numPages, `Rendering page ${pageNumber} of ${pdf.numPages}`);
    }
  } finally {
    await pdf.destroy();
  }

  const imageName = outputFileName(file.name, target as FormatId);
  if (pages.length === 1) return { blob: pages[0], fileName: imageName };

  onProgress(null, 'Zipping pages');
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const stem = imageName.replace(/\.[A-Za-z0-9]+$/, '');
  const names = uniqueFileNames(pages.map((_, i) => `${stem}-page-${String(i + 1).padStart(3, '0')}.${target}`));
  pages.forEach((blob, i) => zip.file(names[i], blob));
  const archive = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  return {
    blob: archive,
    fileName: `${stem}-pages.zip`,
    warning: `The PDF has ${pages.length} pages, so the images were bundled into a ZIP file.`,
  };
}
