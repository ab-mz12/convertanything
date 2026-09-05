/**
 * File type detection. We trust the bytes first (magic numbers), then the extension, then the
 * browser-reported MIME type, and finally a "does this look like text?" heuristic.
 */
import { FORMATS, formatFromExtension, formatFromMime, type FormatDef, type FormatId } from './formats';

export type DetectionSource = 'signature' | 'extension' | 'mime' | 'heuristic';

export interface Detection {
  format: FormatDef;
  /** How we decided. */
  source: DetectionSource;
  /** The extension named a different known format than the file's bytes did (e.g. a PNG called .jpg). */
  extensionMismatch: boolean;
}

export interface DetectInput {
  name: string;
  mime?: string | null;
  /** The first few KB of the file. 4 KB is plenty. */
  bytes: Uint8Array;
}

/** Lowercase extension without the dot, or '' when there is none. */
export function getExtension(fileName: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  const end = Math.min(bytes.length, start + length);
  for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

/** MPEG audio frame header (for MP3s without an ID3 tag). */
function hasMp3FrameSync(b: Uint8Array): boolean {
  if (b.length < 4 || b[0] !== 0xff || (b[1] & 0xe0) !== 0xe0) return false;
  const version = (b[1] >> 3) & 0x03; // 01 is reserved
  const layer = (b[1] >> 1) & 0x03; // 01 = Layer III
  const bitrate = (b[2] >> 4) & 0x0f; // 0000 = free, 1111 = bad
  const sampleRate = (b[2] >> 2) & 0x03; // 11 is reserved
  return version !== 1 && layer === 1 && bitrate !== 0 && bitrate !== 0x0f && sampleRate !== 3;
}

const ISO_BMFF_FAMILY = new Set<FormatId>(['mp4', 'mov', 'm4a']);

/**
 * Identify a format purely from leading bytes. `extensionHint` only disambiguates container
 * families that share a signature (MP4/MOV/M4A are all ISO-BMFF, DOCX is a ZIP).
 */
export function sniffSignature(bytes: Uint8Array, extensionHint = ''): FormatId | undefined {
  if (bytes.length < 4) return undefined;

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg';

  const head6 = ascii(bytes, 0, 6);
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif';

  const head4 = head6.slice(0, 4);
  if (head4 === 'RIFF') {
    const kind = ascii(bytes, 8, 4);
    if (kind === 'WEBP') return 'webp';
    if (kind === 'WAVE') return 'wav';
    if (kind === 'AVI ') return 'avi';
    return undefined;
  }
  if (head4 === '%PDF') return 'pdf';
  if (head4 === 'OggS') return 'ogg';
  if (head4 === 'fLaC') return 'flac';
  if (head4.startsWith('ID3')) return 'mp3';

  // ISO base media file format: MP4, MOV, M4A, AVIF, HEIC ... all start with an `ftyp` box.
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'avif';
    if (brand.startsWith('hei') || brand.startsWith('mif') || brand.startsWith('msf')) return undefined; // HEIF/HEIC
    const hinted = formatFromExtension(extensionHint)?.id;
    if (hinted && ISO_BMFF_FAMILY.has(hinted)) return hinted;
    if (brand === 'qt  ') return 'mov';
    if (brand.startsWith('M4A') || brand.startsWith('M4B')) return 'm4a';
    return 'mp4';
  }

  // EBML: Matroska or WebM. The DocType string sits within the first few dozen bytes.
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return ascii(bytes, 0, 128).includes('webm') ? 'webm' : 'mkv';
  }

  // BMP: "BM" + 4-byte size + 4 reserved zero bytes.
  if (head4.startsWith('BM') && bytes.length >= 14 && bytes[6] === 0 && bytes[7] === 0 && bytes[8] === 0 && bytes[9] === 0) {
    return 'bmp';
  }

  // ZIP container. A DOCX is a ZIP, but so are XLSX, PPTX, EPUB ... only claim DOCX when the
  // extension agrees.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return extensionHint === 'docx' ? 'docx' : undefined;
  }

  if (hasMp3FrameSync(bytes)) return 'mp3';

  return undefined;
}

/** Heuristic: UTF BOM, or no NUL bytes and hardly any control characters. */
export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  if (startsWith(bytes, [0xef, 0xbb, 0xbf]) || startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff])) {
    return true;
  }
  const n = Math.min(bytes.length, 2048);
  let control = 0;
  for (let i = 0; i < n; i++) {
    const c = bytes[i];
    if (c === 0) return false;
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d && c !== 0x0c && c !== 0x1b) control++;
  }
  return control / n < 0.02;
}

export function detectFormat({ name, mime, bytes }: DetectInput): Detection | undefined {
  const ext = getExtension(name);
  const byExtension = formatFromExtension(ext);

  const sniffed = sniffSignature(bytes, ext);
  if (sniffed) {
    return {
      format: FORMATS[sniffed],
      source: 'signature',
      extensionMismatch: byExtension !== undefined && byExtension.id !== sniffed,
    };
  }

  if (byExtension) {
    if (byExtension.id === 'txt') {
      // Only accept text extensions when the content is actually text (empty files are fine).
      if (bytes.length === 0 || looksLikeText(bytes)) {
        return { format: byExtension, source: 'extension', extensionMismatch: false };
      }
      return undefined;
    }
    // No recognisable signature but a known extension: trust it so the user gets a precise
    // conversion error ("could not decode") rather than a vague "unsupported file".
    return { format: byExtension, source: 'extension', extensionMismatch: false };
  }

  const byMime = formatFromMime(mime);
  if (byMime) {
    return { format: byMime, source: 'mime', extensionMismatch: false };
  }

  if (looksLikeText(bytes)) {
    return { format: FORMATS.txt, source: 'heuristic', extensionMismatch: false };
  }

  return undefined;
}

/** Browser entry point: reads the first 4 KB of the file and detects its format. */
export async function detectFile(file: File): Promise<Detection | undefined> {
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  return detectFormat({ name: file.name, mime: file.type, bytes: head });
}
