import { jsPDF } from 'jspdf';
import { outputFileName } from '../../formats';
import { decodeImage } from '../image/imageCore';
import { ConversionError, type ConversionRequest, type ConversionResult } from '../types';

/** Places the image, scaled to fit, centred on a single A4 page in the matching orientation. */
export async function imageToPdf(request: ConversionRequest): Promise<ConversionResult> {
  const { file, source, options, onProgress } = request;
  onProgress(null, 'Rendering image');

  const bitmap = await decodeImage(file, source);
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ConversionError('Could not create a drawing context.');
  const lossy = source === 'jpg';
  if (lossy) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const dataUrl = lossy
    ? canvas.toDataURL('image/jpeg', Math.max(options.imageQuality, 0.85))
    : canvas.toDataURL('image/png');
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: width > height ? 'landscape' : 'portrait',
    compress: true,
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const scale = Math.min((pageWidth - margin * 2) / width, (pageHeight - margin * 2) / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  doc.addImage(
    dataUrl,
    lossy ? 'JPEG' : 'PNG',
    (pageWidth - drawWidth) / 2,
    (pageHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
    undefined,
    'FAST',
  );

  return { blob: doc.output('blob'), fileName: outputFileName(file.name, 'pdf') };
}
