import { describe, expect, it } from 'vitest';
import {
  FORMATS,
  FORMAT_IDS,
  acceptAttribute,
  defaultTarget,
  formatFromExtension,
  formatFromMime,
  formatsInCategory,
  getTargets,
  isValidConversion,
  outputFileName,
} from './formats';

describe('format registry', () => {
  it('has unique extensions across formats', () => {
    const seen = new Map<string, string>();
    for (const id of FORMAT_IDS) {
      for (const ext of FORMATS[id].extensions) {
        expect(seen.has(ext), `extension .${ext} is claimed by both ${seen.get(ext)} and ${id}`).toBe(false);
        seen.set(ext, id);
      }
    }
  });

  it('resolves extensions and MIME types case-insensitively', () => {
    expect(formatFromExtension('.JPEG')?.id).toBe('jpg');
    expect(formatFromExtension('Png')?.id).toBe('png');
    expect(formatFromExtension('')).toBeUndefined();
    expect(formatFromExtension('xyz')).toBeUndefined();
    expect(formatFromMime('Audio/X-WAV')?.id).toBe('wav');
    expect(formatFromMime('text/plain; charset=utf-8')?.id).toBe('txt');
    expect(formatFromMime('application/octet-stream')).toBeUndefined();
    expect(formatFromMime(undefined)).toBeUndefined();
  });

  it('builds an accept attribute covering every input extension', () => {
    const accept = acceptAttribute();
    expect(accept).toContain('.docx');
    expect(accept).toContain('.jpeg');
    expect(accept).toContain('.mkv');
    expect(accept.split(',').every((part) => part.startsWith('.'))).toBe(true);
  });
});

describe('getTargets', () => {
  it('never offers the source format itself and never duplicates', () => {
    for (const id of FORMAT_IDS) {
      const targets = getTargets(id);
      expect(targets).not.toContain(id);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  it('offers images every other image format plus PDF, but nothing else', () => {
    const targets = getTargets('jpg');
    expect(targets).toEqual(expect.arrayContaining(['png', 'webp', 'gif', 'bmp', 'avif', 'pdf']));
    expect(targets).not.toContain('mp3');
    expect(targets).not.toContain('mp4');
    expect(targets).not.toContain('docx');
    expect(targets).toHaveLength(6);
  });

  it('offers video other containers, audio extraction and GIF', () => {
    const targets = getTargets('mp4');
    expect(targets).toEqual(
      expect.arrayContaining(['mov', 'webm', 'avi', 'mkv', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'gif']),
    );
    expect(targets).not.toContain('mp4');
    expect(targets).not.toContain('png');
    expect(targets).not.toContain('pdf');
  });

  it('keeps audio within audio', () => {
    const targets = getTargets('mp3');
    expect(targets).toEqual(expect.arrayContaining(['wav', 'ogg', 'm4a', 'flac']));
    expect(targets).toHaveLength(formatsInCategory('audio').length - 1);
    expect(targets.some((t) => FORMATS[t].category !== 'audio')).toBe(false);
  });

  it('offers only the supported document conversions', () => {
    expect(getTargets('docx')).toEqual(['pdf', 'txt']);
    expect(getTargets('pdf')).toEqual(['txt']);
    expect(getTargets('txt')).toEqual(['pdf']);
  });
});

describe('isValidConversion', () => {
  it('accepts supported pairs and rejects impossible ones', () => {
    expect(isValidConversion('jpg', 'png')).toBe(true);
    expect(isValidConversion('mp4', 'mp3')).toBe(true);
    expect(isValidConversion('mp4', 'gif')).toBe(true);
    expect(isValidConversion('docx', 'pdf')).toBe(true);
    expect(isValidConversion('jpg', 'mp3')).toBe(false);
    expect(isValidConversion('mp3', 'mp4')).toBe(false);
    expect(isValidConversion('pdf', 'docx')).toBe(false);
    expect(isValidConversion('png', 'png')).toBe(false);
    expect(isValidConversion('nope', 'png')).toBe(false);
    expect(isValidConversion('png', 'nope')).toBe(false);
  });
});

describe('defaultTarget', () => {
  it('picks a sensible, valid default for every format', () => {
    expect(defaultTarget('png')).toBe('jpg');
    expect(defaultTarget('jpg')).toBe('png');
    expect(defaultTarget('docx')).toBe('pdf');
    expect(defaultTarget('mov')).toBe('mp4');
    for (const id of FORMAT_IDS) {
      const target = defaultTarget(id);
      expect(target).toBeDefined();
      expect(isValidConversion(id, target!)).toBe(true);
    }
  });
});

describe('outputFileName', () => {
  it('swaps the extension', () => {
    expect(outputFileName('photo.JPG', 'png')).toBe('photo.png');
    expect(outputFileName('My Report.docx', 'pdf')).toBe('My Report.pdf');
    expect(outputFileName('clip.mp4', 'mp3')).toBe('clip.mp3');
  });
  it('appends an extension when there is none', () => {
    expect(outputFileName('README', 'pdf')).toBe('README.pdf');
  });
  it('never returns the input name unchanged', () => {
    expect(outputFileName('image.jpg', 'jpg')).toBe('image-converted.jpg');
    expect(outputFileName('.png', 'png')).toBe('converted.png');
  });
});
