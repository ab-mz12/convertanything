/**
 * A tiny flow-layout engine on top of jsPDF: wrapped paragraphs, headings, bullet lists, simple
 * bordered tables and scaled images, with automatic page breaks, page numbers, and proper
 * right-to-left (Arabic/Hebrew) text handling.
 */
import { jsPDF } from 'jspdf';
import { hasRtlText, paragraphDirection, toVisualOrder, type Direction } from './bidi';
import { DOCUMENT_FONT, loadDocumentFonts, registerDocumentFonts } from './pdfFonts';

// jsPDF ships a hook that rewrites Arabic letters into positional forms on every text() call. We
// do that ourselves (in logical order, *before* bidi reordering), so the hook must not run again
// on the reordered string. Removing it from the static event list disables it for new documents.
{
  const api = jsPDF.API as unknown as { events?: Array<[string, unknown]>; processArabic?: unknown };
  if (Array.isArray(api.events)) {
    api.events = api.events.filter(([, handler]) => handler !== api.processArabic);
  }
}

export type FontFamily = 'helvetica' | 'courier' | 'times';
export type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

export interface TextOptions {
  size?: number;
  style?: FontStyle;
  /** Explicit family; defaults to the embedded Unicode font (or Helvetica when unavailable). */
  family?: FontFamily;
  color?: string;
  /** Extra vertical space (pt) after the block. */
  spacingAfter?: number;
  /** Indent (pt) on the leading side of the paragraph. */
  indent?: number;
}

export interface ImageSource {
  /** Base64 data URL (PNG or JPEG). */
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  /** Natural pixel dimensions. */
  width: number;
  height: number;
}

const LINE_HEIGHT = 1.35;
const PX_TO_PT = 0.75;

/**
 * jsPDF also ships a bidi engine (a postProcessText hook) that, by default, treats text as visual
 * LTR input and converts it to logical order, which would undo our own reordering. Declaring the
 * input and output as visual LTR makes that hook leave the text untouched.
 */
const KEEP_VISUAL_ORDER = { isInputVisual: true, isOutputVisual: true, isInputRtl: false, isOutputRtl: false } as const;

export class PdfWriter {
  readonly doc: jsPDF;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly margin = 56;
  y: number;
  private bodyFamily: string = 'helvetica';
  private unicodeFont = false;
  private readonly missingGlyphs = new Set<string>();

  constructor(orientation: 'portrait' | 'landscape' = 'portrait') {
    this.doc = new jsPDF({ unit: 'pt', format: 'a4', orientation, compress: true });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.y = this.margin;
  }

  /**
   * Embed the Unicode font (Latin + Arabic). Resolves to false, leaving Helvetica in place, if the
   * font files cannot be fetched.
   */
  async useDocumentFonts(): Promise<boolean> {
    const fonts = await loadDocumentFonts();
    if (!fonts) return false;
    registerDocumentFonts(this.doc, fonts);
    this.bodyFamily = DOCUMENT_FONT;
    this.unicodeFont = true;
    return true;
  }

  get hasUnicodeFont(): boolean {
    return this.unicodeFont;
  }

  /** Characters that could not be drawn (no glyph in the font and no sensible substitute). */
  get unsupportedCharacters(): string[] {
    return [...this.missingGlyphs];
  }

  /** Whether the *current* font has a glyph for a character. */
  private fontHasGlyph(char: string): boolean {
    if (!this.unicodeFont) return WIN_ANSI_ONLY.test(char);
    const metadata = (this.doc.internal as unknown as { getFont(): { metadata?: TtfMetadata } }).getFont().metadata;
    if (!metadata || typeof metadata.characterToGlyph !== 'function') return true;
    return metadata.characterToGlyph(char.charCodeAt(0)) !== 0;
  }

  /**
   * Replace characters the font cannot show with the closest thing it can (ā → a, ʾ → ’), and
   * remember the ones that had no substitute so the caller can warn about them.
   */
  private prepare(text: string): string {
    let out = '';
    for (const char of text) {
      if (/\s/.test(char) || this.fontHasGlyph(char)) {
        out += char;
        continue;
      }
      const substitute = SUBSTITUTES[char] ?? char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (substitute && substitute !== char && [...substitute].every((c) => this.fontHasGlyph(c))) {
        out += substitute;
        continue;
      }
      this.missingGlyphs.add(char);
      out += char;
    }
    return out;
  }

  get contentWidth(): number {
    return this.pageWidth - this.margin * 2;
  }

  get bottom(): number {
    return this.pageHeight - this.margin;
  }

  addPage(): void {
    this.doc.addPage();
    this.y = this.margin;
  }

  /** Start a new page if `height` would overflow the current one. */
  ensureSpace(height: number): void {
    if (this.y + height > this.bottom && this.y > this.margin) this.addPage();
  }

  space(points: number): void {
    this.y += points;
  }

  setFont(size: number, style: FontStyle = 'normal', family?: FontFamily): void {
    this.doc.setFont(family ?? this.bodyFamily, style);
    this.doc.setFontSize(size);
  }

  private lines(text: string, maxWidth: number): string[] {
    if (!text) return [''];
    const result = this.doc.splitTextToSize(text, Math.max(maxWidth, 20)) as string[];
    return result.length ? result : [''];
  }

  /** Draw one wrapped line between `left` and `right`, honouring its direction. */
  private drawLine(line: string, left: number, right: number, y: number, direction: Direction): void {
    const shaped = this.unicodeFont && hasRtlText(line) ? this.doc.processArabic(line) : line;
    const visual = toVisualOrder(shaped, direction);
    if (direction === 'rtl') this.doc.text(visual, right, y, { ...KEEP_VISUAL_ORDER, baseline: 'top', align: 'right' });
    else this.doc.text(visual, left, y, { ...KEEP_VISUAL_ORDER, baseline: 'top' });
  }

  writeText(text: string, options: TextOptions = {}): void {
    const size = options.size ?? 11;
    const indent = options.indent ?? 0;
    const lineHeight = size * LINE_HEIGHT;
    this.setFont(size, options.style, options.family);
    this.doc.setTextColor(options.color ?? '#111111');
    text = this.prepare(text);
    const direction = paragraphDirection(text);
    const left = this.margin + (direction === 'ltr' ? indent : 0);
    const right = this.pageWidth - this.margin - (direction === 'rtl' ? indent : 0);
    for (const line of this.lines(text, right - left)) {
      this.ensureSpace(lineHeight);
      this.drawLine(line, left, right, this.y, direction);
      this.y += lineHeight;
    }
    this.y += options.spacingAfter ?? 0;
  }

  /** A list item: `marker` in the gutter, wrapped text beside it (mirrored for RTL items). */
  writeListItem(text: string, marker: string, options: TextOptions = {}): void {
    const size = options.size ?? 11;
    const indent = options.indent ?? 0;
    const gutter = 18;
    const lineHeight = size * LINE_HEIGHT;
    this.setFont(size, options.style, options.family);
    this.doc.setTextColor(options.color ?? '#111111');
    text = this.prepare(text);
    const direction = paragraphDirection(text);
    const left = direction === 'ltr' ? this.margin + indent + gutter : this.margin;
    const right = direction === 'ltr' ? this.pageWidth - this.margin : this.pageWidth - this.margin - indent - gutter;
    const lines = this.lines(text, right - left);
    this.ensureSpace(lineHeight);
    if (direction === 'ltr') this.doc.text(marker, this.margin + indent, this.y, { ...KEEP_VISUAL_ORDER, baseline: 'top' });
    else this.doc.text(marker, this.pageWidth - this.margin - indent, this.y, { ...KEEP_VISUAL_ORDER, baseline: 'top', align: 'right' });
    lines.forEach((line, i) => {
      if (i > 0) this.ensureSpace(lineHeight);
      this.drawLine(line, left, right, this.y, direction);
      this.y += lineHeight;
    });
    this.y += options.spacingAfter ?? 2;
  }

  writeTable(rows: string[][]): void {
    const columns = Math.max(1, ...rows.map((r) => r.length));
    const colWidth = this.contentWidth / columns;
    const padding = 4;
    const size = 9;
    const lineHeight = size * LINE_HEIGHT;
    this.setFont(size);
    this.doc.setTextColor('#111111');
    this.doc.setDrawColor('#9ca3af');
    this.doc.setLineWidth(0.5);

    for (const rawRow of rows) {
      const row = rawRow.map((cell) => this.prepare(cell));
      const cells = Array.from({ length: columns }, (_, i) => this.lines(row[i] ?? '', colWidth - padding * 2));
      const rowHeight = Math.max(...cells.map((c) => c.length)) * lineHeight + padding * 2;
      this.ensureSpace(rowHeight);
      cells.forEach((lines, c) => {
        const x = this.margin + c * colWidth;
        const direction = paragraphDirection(row[c] ?? '');
        this.doc.rect(x, this.y, colWidth, rowHeight);
        lines.forEach((line, i) => {
          this.drawLine(line, x + padding, x + colWidth - padding, this.y + padding + i * lineHeight, direction);
        });
      });
      this.y += rowHeight;
    }
    this.y += 10;
  }

  /** Draws an image scaled to fit the content width (and page height), left aligned. */
  writeImage(image: ImageSource): void {
    let width = Math.min(image.width * PX_TO_PT, this.contentWidth);
    let height = (width * image.height) / image.width;
    const maxHeight = this.bottom - this.margin;
    if (height > maxHeight) {
      height = maxHeight;
      width = (height * image.width) / image.height;
    }
    this.ensureSpace(height);
    this.doc.addImage(image.dataUrl, image.format, this.margin, this.y, width, height, undefined, 'FAST');
    this.y += height + 10;
  }

  addPageNumbers(): void {
    const total = this.doc.getNumberOfPages();
    if (total < 2) return;
    for (let page = 1; page <= total; page++) {
      this.doc.setPage(page);
      this.setFont(9);
      this.doc.setTextColor('#9ca3af');
      this.doc.text(`${page} / ${total}`, this.pageWidth / 2, this.pageHeight - 30, { ...KEEP_VISUAL_ORDER, align: 'center' });
    }
  }

  toBlob(): Blob {
    return this.doc.output('blob');
  }
}

/** Characters jsPDF's built-in Helvetica can show: ASCII, Latin-1 and a few typographic symbols. */
const WIN_ANSI_ONLY = /^[\x20-\x7E\xA0-\xFF\t\n\r€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]*$/;

/** Substitutes for characters the fonts lack but that have an obvious look-alike. */
const SUBSTITUTES: Record<string, string> = {
  'ʾ': '’',
  'ʿ': '‘',
  'ʼ': '’',
  'ʻ': '‘',
  '‑': '-',
  '‒': '-',
  '−': '-',
  'ﬁ': 'fi',
  'ﬂ': 'fl',
  '\u00AD': '',
};

interface TtfMetadata {
  characterToGlyph?: (code: number) => number;
}

/** Build the user-facing warning for characters that were left blank. */
export function unsupportedGlyphsWarning(chars: string[]): string | undefined {
  if (chars.length === 0) return undefined;
  const sample = chars.slice(0, 8).join(' ');
  return `The PDF font has no glyphs for ${chars.length === 1 ? 'this character' : 'these characters'}, so they were left blank: ${sample}${chars.length > 8 ? ' …' : ''}`;
}

/**
 * Turn an image source (data URL) into something jsPDF can embed: PNG/JPEG data URLs are used
 * directly, anything else is re-encoded through a canvas. Returns null if the image cannot be
 * decoded by this browser (e.g. EMF/WMF clip art inside Word files).
 */
export async function loadImageSource(src: string): Promise<ImageSource | null> {
  // Only inline images: never fetch remote URLs, nothing may leave the browser.
  if (!/^data:image\//i.test(src)) return null;
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    await img.decode();
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return null;
    const mime = /^data:(image\/[a-z0-9.+-]+)/i.exec(src)?.[1]?.toLowerCase();
    if (mime === 'image/png') return { dataUrl: src, format: 'PNG', width, height };
    if (mime === 'image/jpeg' || mime === 'image/jpg') return { dataUrl: src, format: 'JPEG', width, height };
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL('image/png'), format: 'PNG', width, height };
  } catch {
    return null;
  }
}
