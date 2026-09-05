/**
 * Central registry of every format ConvertAnything understands, plus the rules for which
 * conversions are offered. Everything else (detection, routing, UI dropdowns) derives from this.
 */

export type Category = 'image' | 'video' | 'audio' | 'document';

export type FormatId =
  // images
  | 'jpg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'bmp'
  | 'avif'
  // video
  | 'mp4'
  | 'mov'
  | 'webm'
  | 'avi'
  | 'mkv'
  // audio
  | 'mp3'
  | 'wav'
  | 'ogg'
  | 'm4a'
  | 'flac'
  // documents
  | 'pdf'
  | 'docx'
  | 'txt';

export interface FormatDef {
  id: FormatId;
  /** Human readable name shown in the UI. */
  label: string;
  /** Known file extensions, lowercase, without dot. The first one is used for output files. */
  extensions: readonly string[];
  /** Known MIME types. The first one is used for output blobs. */
  mimes: readonly string[];
  category: Category;
}

export const FORMATS: Readonly<Record<FormatId, FormatDef>> = {
  jpg: { id: 'jpg', label: 'JPEG', extensions: ['jpg', 'jpeg', 'jpe', 'jfif'], mimes: ['image/jpeg', 'image/pjpeg'], category: 'image' },
  png: { id: 'png', label: 'PNG', extensions: ['png'], mimes: ['image/png'], category: 'image' },
  webp: { id: 'webp', label: 'WebP', extensions: ['webp'], mimes: ['image/webp'], category: 'image' },
  gif: { id: 'gif', label: 'GIF', extensions: ['gif'], mimes: ['image/gif'], category: 'image' },
  bmp: { id: 'bmp', label: 'BMP', extensions: ['bmp', 'dib'], mimes: ['image/bmp', 'image/x-ms-bmp', 'image/x-bmp'], category: 'image' },
  avif: { id: 'avif', label: 'AVIF', extensions: ['avif'], mimes: ['image/avif'], category: 'image' },

  mp4: { id: 'mp4', label: 'MP4', extensions: ['mp4', 'm4v'], mimes: ['video/mp4', 'video/x-m4v'], category: 'video' },
  mov: { id: 'mov', label: 'MOV', extensions: ['mov', 'qt'], mimes: ['video/quicktime'], category: 'video' },
  webm: { id: 'webm', label: 'WebM', extensions: ['webm'], mimes: ['video/webm', 'audio/webm'], category: 'video' },
  avi: { id: 'avi', label: 'AVI', extensions: ['avi'], mimes: ['video/x-msvideo', 'video/avi', 'video/msvideo'], category: 'video' },
  mkv: { id: 'mkv', label: 'MKV', extensions: ['mkv'], mimes: ['video/x-matroska'], category: 'video' },

  mp3: { id: 'mp3', label: 'MP3', extensions: ['mp3'], mimes: ['audio/mpeg', 'audio/mp3'], category: 'audio' },
  wav: { id: 'wav', label: 'WAV', extensions: ['wav', 'wave'], mimes: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'], category: 'audio' },
  ogg: { id: 'ogg', label: 'OGG', extensions: ['ogg', 'oga', 'opus'], mimes: ['audio/ogg', 'application/ogg', 'audio/opus'], category: 'audio' },
  m4a: { id: 'm4a', label: 'M4A', extensions: ['m4a', 'm4b'], mimes: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'], category: 'audio' },
  flac: { id: 'flac', label: 'FLAC', extensions: ['flac'], mimes: ['audio/flac', 'audio/x-flac'], category: 'audio' },

  pdf: { id: 'pdf', label: 'PDF', extensions: ['pdf'], mimes: ['application/pdf'], category: 'document' },
  docx: {
    id: 'docx',
    label: 'Word (DOCX)',
    extensions: ['docx'],
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    category: 'document',
  },
  txt: {
    id: 'txt',
    label: 'Text',
    extensions: ['txt', 'text', 'md', 'markdown', 'log', 'csv'],
    mimes: ['text/plain', 'text/markdown', 'text/csv'],
    category: 'document',
  },
};

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];

export const CATEGORY_LABEL: Record<Category, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
};

export function isFormatId(value: string): value is FormatId {
  return Object.prototype.hasOwnProperty.call(FORMATS, value);
}

export function formatsInCategory(category: Category): FormatId[] {
  return FORMAT_IDS.filter((id) => FORMATS[id].category === category);
}

/** Canonical output extension (without dot). */
export function extensionFor(id: FormatId): string {
  return FORMATS[id].extensions[0];
}

/** Canonical MIME type. */
export function mimeFor(id: FormatId): string {
  return FORMATS[id].mimes[0];
}

export function formatFromExtension(extension: string): FormatDef | undefined {
  const ext = extension.toLowerCase().replace(/^\./, '');
  if (!ext) return undefined;
  return FORMAT_IDS.map((id) => FORMATS[id]).find((f) => f.extensions.includes(ext));
}

export function formatFromMime(mime: string | undefined | null): FormatDef | undefined {
  if (!mime) return undefined;
  const normalized = mime.toLowerCase().split(';')[0].trim();
  if (!normalized) return undefined;
  return FORMAT_IDS.map((id) => FORMATS[id]).find((f) => f.mimes.includes(normalized));
}

/** `accept` attribute value for <input type="file">: every extension we can read. */
export function acceptAttribute(): string {
  return FORMAT_IDS.flatMap((id) => FORMATS[id].extensions.map((e) => `.${e}`)).join(',');
}

// ---------------------------------------------------------------------------------------------
// Conversion rules
// ---------------------------------------------------------------------------------------------

const DOCUMENT_TARGETS: Partial<Record<FormatId, readonly FormatId[]>> = {
  docx: ['pdf', 'txt'],
  pdf: ['txt'],
  txt: ['pdf'],
};

/**
 * Every target format a file of `source` format can be converted to. The list never contains the
 * source itself and never crosses categories in impossible ways (no jpg → mp3).
 */
export function getTargets(source: FormatId): FormatId[] {
  const { category } = FORMATS[source];
  const others = (cat: Category) => formatsInCategory(cat).filter((id) => id !== source);
  switch (category) {
    case 'image':
      // Any image → any other image, or wrapped into a PDF page.
      return [...others('image'), 'pdf'];
    case 'video':
      // Video → other containers, audio extraction, or an animated GIF.
      return [...others('video'), ...formatsInCategory('audio'), 'gif'];
    case 'audio':
      return others('audio');
    case 'document':
      return [...(DOCUMENT_TARGETS[source] ?? [])];
  }
}

export function isValidConversion(source: string, target: string): boolean {
  if (!isFormatId(source) || !isFormatId(target)) return false;
  return getTargets(source).includes(target);
}

const PREFERRED_DEFAULT: Partial<Record<FormatId, FormatId>> = {
  jpg: 'png',
  png: 'jpg',
  webp: 'jpg',
  gif: 'png',
  bmp: 'png',
  avif: 'jpg',
  mp4: 'mov',
  mov: 'mp4',
  webm: 'mp4',
  avi: 'mp4',
  mkv: 'mp4',
  mp3: 'wav',
  wav: 'mp3',
  ogg: 'mp3',
  m4a: 'mp3',
  flac: 'mp3',
  docx: 'pdf',
  pdf: 'txt',
  txt: 'pdf',
};

/** The target pre-selected in the dropdown when a file is added. */
export function defaultTarget(source: FormatId): FormatId | undefined {
  const targets = getTargets(source);
  const preferred = PREFERRED_DEFAULT[source];
  return preferred && targets.includes(preferred) ? preferred : targets[0];
}

/** `photo.JPG` + png → `photo.png`. Never returns the input name unchanged. */
export function outputFileName(inputName: string, target: FormatId): string {
  const ext = extensionFor(target);
  const base = inputName.replace(/\.[A-Za-z0-9]{1,8}$/, '').trim() || 'converted';
  const name = `${base}.${ext}`;
  return name.toLowerCase() === inputName.trim().toLowerCase() ? `${base}-converted.${ext}` : name;
}
