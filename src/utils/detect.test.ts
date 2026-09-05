import { describe, expect, it } from 'vitest';
import { detectFormat, getExtension, looksLikeText, sniffSignature, sniffTextFormat } from './detect';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new Uint8Array(Array.from(text, (c) => c.charCodeAt(0)));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46);
const ftyp = (brand: string) => concat(bytes(0, 0, 0, 0x20), ascii('ftyp'), ascii(brand), bytes(0, 0, 0, 0));
const riff = (kind: string) => concat(ascii('RIFF'), bytes(0, 0, 0, 0), ascii(kind), bytes(0, 0, 0, 0));
const ebml = (docType: string) =>
  concat(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84), ascii(docType));
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00);
const BINARY_JUNK = bytes(0x00, 0x01, 0x02, 0x03, 0xde, 0xad, 0xbe, 0xef, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);

describe('getExtension', () => {
  it('returns the lowercase extension without the dot', () => {
    expect(getExtension('Photo.JPG')).toBe('jpg');
    expect(getExtension('archive.tar.gz')).toBe('gz');
    expect(getExtension('  notes.txt ')).toBe('txt');
  });
  it('returns an empty string when there is no extension', () => {
    expect(getExtension('README')).toBe('');
    expect(getExtension('.bashrc')).toBe('bashrc');
  });
});

describe('sniffSignature', () => {
  it.each([
    ['png', PNG],
    ['jpg', JPEG],
    ['gif', ascii('GIF89a ')],
    ['gif', ascii('GIF87a ')],
    ['webp', riff('WEBP')],
    ['wav', riff('WAVE')],
    ['avi', riff('AVI ')],
    ['pdf', ascii('%PDF-1.7\n')],
    ['ogg', ascii('OggS ')],
    ['flac', ascii('fLaC  ')],
    ['mp3', ascii('ID3 ')],
    ['mp3', bytes(0xff, 0xfb, 0x90, 0x00)],
    ['avif', ftyp('avif')],
    ['mov', ftyp('qt  ')],
    ['m4a', ftyp('M4A ')],
    ['mp4', ftyp('isom')],
    ['mp4', ftyp('mp42')],
    ['webm', ebml('webm')],
    ['mkv', ebml('matroska')],
    ['bmp', concat(ascii('BM'), bytes(0x36, 0x00, 0x0c, 0x00, 0, 0, 0, 0, 0x36, 0, 0, 0))],
    ['flv', concat(ascii('FLV'), bytes(0x01, 0x05, 0, 0, 0, 9))],
    ['aiff', concat(ascii('FORM'), bytes(0, 0, 0, 0), ascii('AIFF'))],
    ['aiff', concat(ascii('FORM'), bytes(0, 0, 0, 0), ascii('AIFC'))],
    ['amr', ascii('#!AMR\n')],
    ['wmv', bytes(0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9)],
    ['mpg', bytes(0x00, 0x00, 0x01, 0xba, 0x44, 0x00)],
    ['mpg', bytes(0x00, 0x00, 0x01, 0xb3, 0x14, 0x00)],
    ['ico', bytes(0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 1, 0, 32, 0)],
    ['aac', bytes(0xff, 0xf1, 0x50, 0x80)],
    ['3gp', ftyp('3gp4')],
    ['opus', concat(ascii('OggS'), bytes(0, 2, 0, 0, 0, 0, 0, 0, 0, 0), ascii('OpusHead'))],
    ['ogg', concat(ascii('OggS'), bytes(0, 2, 0, 0, 0, 0, 0, 0, 0, 0), ascii('\x01vorbis'))],
  ] as const)('detects %s', (expected, data) => {
    expect(sniffSignature(data)).toBe(expected);
  });

  it('detects an MPEG transport stream by its sync bytes', () => {
    const ts = new Uint8Array(400);
    ts[0] = 0x47;
    ts[188] = 0x47;
    ts[376] = 0x47;
    expect(sniffSignature(ts)).toBe('ts');
  });

  it('tells WMA from WMV by extension (same ASF container)', () => {
    const asf = bytes(0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9);
    expect(sniffSignature(asf, 'wma')).toBe('wma');
    expect(sniffSignature(asf, 'wmv')).toBe('wmv');
  });

  it('uses the extension to disambiguate the ISO-BMFF family', () => {
    expect(sniffSignature(ftyp('isom'), 'mov')).toBe('mov');
    expect(sniffSignature(ftyp('isom'), 'm4a')).toBe('m4a');
    expect(sniffSignature(ftyp('isom'), 'm4v')).toBe('mp4');
    expect(sniffSignature(ftyp('qt  '), 'mp4')).toBe('mp4');
  });

  it('does not claim HEIC/HEIF files', () => {
    expect(sniffSignature(ftyp('heic'), 'heic')).toBeUndefined();
    expect(sniffSignature(ftyp('mif1'))).toBeUndefined();
  });

  it('only recognises a ZIP as DOCX when the extension agrees', () => {
    expect(sniffSignature(ZIP, 'docx')).toBe('docx');
    expect(sniffSignature(ZIP, 'xlsx')).toBeUndefined();
    expect(sniffSignature(ZIP, 'zip')).toBeUndefined();
  });

  it('rejects unknown RIFF sub-types, junk and tiny buffers', () => {
    expect(sniffSignature(riff('ACON'))).toBeUndefined();
    expect(sniffSignature(BINARY_JUNK)).toBeUndefined();
    expect(sniffSignature(bytes(0xff, 0xd8))).toBeUndefined();
  });

  it('does not mistake a UTF-16 BOM for an MP3 frame sync', () => {
    expect(sniffSignature(bytes(0xff, 0xfe, 0x68, 0x00, 0x69, 0x00))).toBeUndefined();
  });
});

describe('sniffTextFormat', () => {
  it('recognises SVG and HTML by their opening tags', () => {
    expect(sniffTextFormat(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe('svg');
    expect(sniffTextFormat(ascii('<?xml version="1.0"?>\n<!-- c -->\n<svg></svg>'))).toBe('svg');
    expect(sniffTextFormat(ascii('<!DOCTYPE html><html><body></body></html>'))).toBe('html');
    expect(sniffTextFormat(ascii('<html lang="en">'))).toBe('html');
    expect(sniffTextFormat(ascii('just text <b>with a tag</b>'))).toBeUndefined();
  });
});

describe('looksLikeText', () => {
  it('accepts plain text and BOM-prefixed text', () => {
    expect(looksLikeText(ascii('Hello, world!\nSecond line.\n'))).toBe(true);
    expect(looksLikeText(bytes(0xef, 0xbb, 0xbf, 0x41))).toBe(true);
    expect(looksLikeText(bytes(0xff, 0xfe, 0x41, 0x00))).toBe(true);
  });
  it('rejects binary data and empty buffers', () => {
    expect(looksLikeText(BINARY_JUNK)).toBe(false);
    expect(looksLikeText(PNG)).toBe(false);
    expect(looksLikeText(new Uint8Array())).toBe(false);
  });
});

describe('detectFormat', () => {
  it('trusts the bytes over the extension and flags the mismatch', () => {
    const result = detectFormat({ name: 'actually-a-png.jpg', bytes: PNG });
    expect(result?.format.id).toBe('png');
    expect(result?.source).toBe('signature');
    expect(result?.extensionMismatch).toBe(true);
  });

  it('does not flag a mismatch when extension and bytes agree', () => {
    const result = detectFormat({ name: 'photo.jpeg', bytes: JPEG });
    expect(result?.format.id).toBe('jpg');
    expect(result?.extensionMismatch).toBe(false);
  });

  it('does not flag a mismatch for an unknown extension', () => {
    const result = detectFormat({ name: 'download.bin', bytes: JPEG });
    expect(result?.format.id).toBe('jpg');
    expect(result?.extensionMismatch).toBe(false);
  });

  it('falls back to the extension when there is no recognisable signature', () => {
    const result = detectFormat({ name: 'broken.png', bytes: BINARY_JUNK });
    expect(result?.format.id).toBe('png');
    expect(result?.source).toBe('extension');
  });

  it('recognises text files by extension, heuristic and MIME type', () => {
    expect(detectFormat({ name: 'notes.txt', bytes: ascii('hello') })?.format.id).toBe('txt');
    expect(detectFormat({ name: 'notes.md', bytes: ascii('# Title') })?.format.id).toBe('txt');
    expect(detectFormat({ name: 'data.csv', bytes: ascii('a,b,c') })?.format.id).toBe('txt');
    const heuristic = detectFormat({ name: 'README', bytes: ascii('Just some text') });
    expect(heuristic?.format.id).toBe('txt');
    expect(heuristic?.source).toBe('heuristic');
    expect(detectFormat({ name: 'empty.txt', bytes: new Uint8Array() })?.format.id).toBe('txt');
  });

  it('recognises SVG and HTML files by extension or by content', () => {
    expect(detectFormat({ name: 'logo.svg', bytes: ascii('<svg></svg>') })?.format.id).toBe('svg');
    expect(detectFormat({ name: 'page.htm', bytes: ascii('<p>hi</p>') })?.format.id).toBe('html');
    const byContent = detectFormat({ name: 'download', bytes: ascii('<!doctype html><html></html>') });
    expect(byContent?.format.id).toBe('html');
    expect(byContent?.source).toBe('heuristic');
    expect(detectFormat({ name: 'drawing', bytes: ascii('<svg viewBox="0 0 1 1"/>') })?.format.id).toBe('svg');
    expect(detectFormat({ name: 'binary.svg', bytes: BINARY_JUNK })).toBeUndefined();
  });

  it('refuses a .txt whose content is binary', () => {
    expect(detectFormat({ name: 'sneaky.txt', bytes: BINARY_JUNK })).toBeUndefined();
  });

  it('uses the MIME type when name and bytes are uninformative', () => {
    const result = detectFormat({ name: 'blob', mime: 'image/webp', bytes: BINARY_JUNK });
    expect(result?.format.id).toBe('webp');
    expect(result?.source).toBe('mime');
    expect(detectFormat({ name: 'blob', mime: 'audio/x-wav', bytes: BINARY_JUNK })?.format.id).toBe('wav');
  });

  it('returns undefined for unsupported files', () => {
    expect(detectFormat({ name: 'sheet.xlsx', bytes: ZIP })).toBeUndefined();
    expect(detectFormat({ name: 'photo.heic', bytes: ftyp('heic') })).toBeUndefined();
    expect(detectFormat({ name: 'mystery', bytes: BINARY_JUNK })).toBeUndefined();
    expect(detectFormat({ name: 'empty.bin', bytes: new Uint8Array() })).toBeUndefined();
  });

  it('identifies a DOCX by ZIP signature plus extension', () => {
    const result = detectFormat({ name: 'report.docx', bytes: ZIP });
    expect(result?.format.id).toBe('docx');
    expect(result?.source).toBe('signature');
  });
});
