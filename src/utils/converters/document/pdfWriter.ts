/**
 * A tiny flow-layout engine on top of jsPDF: wrapped paragraphs, headings, bullet lists, simple
 * bordered tables and scaled images, with automatic page breaks and page numbers.
 */
import { jsPDF } from 'jspdf';

export type FontFamily = 'helvetica' | 'courier' | 'times';
export type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

export interface TextOptions {
  size?: number;
  style?: FontStyle;
  family?: FontFamily;
  color?: string;
  /** Extra vertical space (pt) after the block. */
  spacingAfter?: number;
  /** Left indent (pt). */
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

export class PdfWriter {
  readonly doc: jsPDF;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly margin = 56;
  y: number;

  constructor(orientation: 'portrait' | 'landscape' = 'portrait') {
    this.doc = new jsPDF({ unit: 'pt', format: 'a4', orientation, compress: true });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.y = this.margin;
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

  setFont(size: number, style: FontStyle = 'normal', family: FontFamily = 'helvetica'): void {
    this.doc.setFont(family, style);
    this.doc.setFontSize(size);
  }

  private lines(text: string, maxWidth: number): string[] {
    if (!text) return [''];
    const result = this.doc.splitTextToSize(text, Math.max(maxWidth, 20)) as string[];
    return result.length ? result : [''];
  }

  writeText(text: string, options: TextOptions = {}): void {
    const size = options.size ?? 11;
    const indent = options.indent ?? 0;
    const lineHeight = size * LINE_HEIGHT;
    this.setFont(size, options.style, options.family);
    this.doc.setTextColor(options.color ?? '#111111');
    for (const line of this.lines(text, this.contentWidth - indent)) {
      this.ensureSpace(lineHeight);
      this.doc.text(line, this.margin + indent, this.y, { baseline: 'top' });
      this.y += lineHeight;
    }
    this.y += options.spacingAfter ?? 0;
  }

  /** A list item: `marker` in the gutter, wrapped text beside it. */
  writeListItem(text: string, marker: string, options: TextOptions = {}): void {
    const size = options.size ?? 11;
    const indent = options.indent ?? 0;
    const gutter = 18;
    const lineHeight = size * LINE_HEIGHT;
    this.setFont(size, options.style, options.family);
    this.doc.setTextColor(options.color ?? '#111111');
    const lines = this.lines(text, this.contentWidth - indent - gutter);
    this.ensureSpace(lineHeight);
    this.doc.text(marker, this.margin + indent, this.y, { baseline: 'top' });
    lines.forEach((line, i) => {
      if (i > 0) this.ensureSpace(lineHeight);
      this.doc.text(line, this.margin + indent + gutter, this.y, { baseline: 'top' });
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

    for (const row of rows) {
      const cells = Array.from({ length: columns }, (_, i) => this.lines(row[i] ?? '', colWidth - padding * 2));
      const rowHeight = Math.max(...cells.map((c) => c.length)) * lineHeight + padding * 2;
      this.ensureSpace(rowHeight);
      cells.forEach((lines, c) => {
        const x = this.margin + c * colWidth;
        this.doc.rect(x, this.y, colWidth, rowHeight);
        lines.forEach((line, i) => {
          this.doc.text(line, x + padding, this.y + padding + i * lineHeight, { baseline: 'top' });
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
      this.doc.text(`${page} / ${total}`, this.pageWidth / 2, this.pageHeight - 30, { align: 'center' });
    }
  }

  toBlob(): Blob {
    return this.doc.output('blob');
  }
}

/**
 * jsPDF's built-in fonts only cover the WinAnsi character set (ASCII, Latin-1 and a handful of
 * typographic symbols). Detect text outside it so we can warn the user instead of silently
 * producing garbage glyphs.
 */
const WIN_ANSI_ONLY =
  /^[\x20-\x7E\xA0-\xFF\t\n\r€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]*$/;

export function hasUnsupportedGlyphs(text: string): boolean {
  return !WIN_ANSI_ONLY.test(text);
}

export const UNSUPPORTED_GLYPHS_WARNING =
  'Some characters (for example non-Latin scripts or emoji) are not supported by the built-in PDF font and may not render correctly.';

/**
 * Turn an image source (data URL) into something jsPDF can embed: PNG/JPEG data URLs are used
 * directly, anything else is re-encoded through a canvas. Returns null if the image cannot be
 * decoded by this browser (e.g. EMF/WMF clip art inside Word files).
 */
export async function loadImageSource(src: string): Promise<ImageSource | null> {
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
