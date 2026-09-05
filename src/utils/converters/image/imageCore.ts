/**
 * Image conversion logic shared by the Web Worker and the main-thread fallback. Decoding uses the
 * browser's own codecs via createImageBitmap; encoding uses canvas for JPEG/PNG/WebP and small
 * JS/WASM encoders for BMP, GIF and AVIF (which no browser can encode natively).
 */
import { mimeFor, type FormatId } from '../../formats';
import { bytesToBlob } from '../../blob';
import { ConversionError } from '../types';
import { encodeBMP } from './bmp';
import { encodeGIF } from './gif';
import { encodeICO } from './ico';

export interface ImageJob {
  file: File;
  source: FormatId;
  target: FormatId;
  /** 0..1 */
  quality: number;
}

export interface ImageWorkerRequest {
  id: number;
  job: ImageJob;
}

export type ImageWorkerResponse =
  | { id: number; ok: true; blob: Blob }
  | { id: number; ok: false; message: string; details?: string };

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

const HAS_OFFSCREEN = typeof OffscreenCanvas !== 'undefined';

/** Targets that keep an alpha channel. Everything else is flattened onto white. */
const ALPHA_TARGETS = new Set<FormatId>(['png', 'webp', 'avif', 'ico']);

/** Sources that createImageBitmap cannot handle reliably; they are decoded through an <img>. */
export const MAIN_THREAD_SOURCES = new Set<FormatId>(['svg', 'ico']);

/** Vector images without a useful intrinsic size are rasterised at this size. */
const SVG_TARGET_SIZE = 1024;
/** Targets the canvas can encode by itself. */
const CANVAS_TARGETS = new Set<FormatId>(['jpg', 'png', 'webp']);

function createCanvas(width: number, height: number): AnyCanvas {
  if (HAS_OFFSCREEN) return new OffscreenCanvas(width, height);
  if (typeof document === 'undefined') {
    throw new ConversionError('This browser cannot render images in a background thread.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function isOffscreen(canvas: AnyCanvas): canvas is OffscreenCanvas {
  return HAS_OFFSCREEN && canvas instanceof OffscreenCanvas;
}

function get2d(canvas: AnyCanvas): CanvasRenderingContext2D {
  const ctx = isOffscreen(canvas) ? canvas.getContext('2d') : canvas.getContext('2d');
  if (!ctx) throw new ConversionError('Could not create a 2D drawing context.');
  // OffscreenCanvasRenderingContext2D has the same drawing API; the cast keeps the code simple.
  return ctx as unknown as CanvasRenderingContext2D;
}

async function canvasToBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  const blob = isOffscreen(canvas)
    ? await canvas.convertToBlob({ type, quality })
    : await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))), type, quality),
      );
  if (blob.type !== type) {
    // Browsers silently fall back to PNG when they cannot encode the requested type.
    throw new ConversionError(`This browser cannot encode ${type.replace('image/', '').toUpperCase()} images.`);
  }
  return blob;
}

/** Decode through an <img> element (main thread only). Used for SVG and ICO. */
async function decodeViaImageElement(file: File, vector: boolean): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    if (!width || !height) {
      width = SVG_TARGET_SIZE;
      height = SVG_TARGET_SIZE;
    } else if (vector && Math.max(width, height) < SVG_TARGET_SIZE) {
      // SVGs are resolution independent: rasterise small ones at a usable size.
      const factor = SVG_TARGET_SIZE / Math.max(width, height);
      width = Math.round(width * factor);
      height = Math.round(height * factor);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0, width, height);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decode any supported image to a bitmap, falling back to a WASM decoder for AVIF. */
export async function decodeImage(file: File, source: FormatId): Promise<ImageBitmap> {
  if (MAIN_THREAD_SOURCES.has(source) && typeof document !== 'undefined') {
    try {
      return await decodeViaImageElement(file, source === 'svg');
    } catch (error) {
      throw new ConversionError(
        `Could not decode this ${source.toUpperCase()} file. It may be malformed or not really a ${source.toUpperCase()}.`,
        String(error),
      );
    }
  }
  try {
    return await createImageBitmap(file);
  } catch (error) {
    if (source === 'avif') {
      try {
        const { decode } = await import('@jsquash/avif');
        const imageData = await decode(await file.arrayBuffer());
        if (!imageData) throw new Error('AVIF decoder returned no image data');
        return await createImageBitmap(imageData);
      } catch (inner) {
        throw new ConversionError('Could not decode this AVIF image.', String(inner));
      }
    }
    throw new ConversionError(
      `Could not decode this image. The file may be corrupted or not really a ${source.toUpperCase()}.`,
      String(error),
    );
  }
}

export async function convertImageCore(job: ImageJob): Promise<Blob> {
  const { target, quality } = job;
  const bitmap = await decodeImage(job.file, job.source);
  const { width, height } = bitmap;
  if (width === 0 || height === 0) {
    bitmap.close();
    throw new ConversionError('The image has no pixels.');
  }

  const canvas = createCanvas(width, height);
  const ctx = get2d(canvas);
  if (!ALPHA_TARGETS.has(target)) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  if (CANVAS_TARGETS.has(target)) {
    return canvasToBlob(canvas, mimeFor(target), target === 'png' ? undefined : quality);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  switch (target) {
    case 'bmp':
      return bytesToBlob(encodeBMP(imageData), mimeFor('bmp'));
    case 'gif':
      return bytesToBlob(encodeGIF(imageData), mimeFor('gif'));
    case 'ico': {
      // Icons are capped at 256 px; downscale larger images proportionally.
      const scale = Math.min(1, 256 / Math.max(width, height));
      const iconWidth = Math.max(1, Math.round(width * scale));
      const iconHeight = Math.max(1, Math.round(height * scale));
      let iconCanvas = canvas;
      if (scale < 1) {
        iconCanvas = createCanvas(iconWidth, iconHeight);
        get2d(iconCanvas).drawImage(canvas, 0, 0, iconWidth, iconHeight);
      }
      const png = new Uint8Array(await (await canvasToBlob(iconCanvas, 'image/png')).arrayBuffer());
      return bytesToBlob(encodeICO(png, iconWidth, iconHeight), mimeFor('ico'));
    }
    case 'avif': {
      const { encode } = await import('@jsquash/avif');
      const buffer = await encode(imageData, { quality: Math.round(quality * 100), speed: 8 });
      return new Blob([buffer], { type: mimeFor('avif') });
    }
    default:
      throw new ConversionError(`Unsupported image target: ${target}`);
  }
}
