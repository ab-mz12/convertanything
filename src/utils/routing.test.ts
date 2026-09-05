import { describe, expect, it } from 'vitest';
import { FORMAT_IDS, getTargets } from './formats';
import { getConverterKind, needsFFmpeg } from './routing';

describe('getConverterKind', () => {
  it('routes image to image through the canvas converter', () => {
    expect(getConverterKind('jpg', 'png')).toBe('image');
    expect(getConverterKind('png', 'avif')).toBe('image');
    expect(getConverterKind('webp', 'gif')).toBe('image');
  });

  it('routes image to pdf through the document converter', () => {
    expect(getConverterKind('jpg', 'pdf')).toBe('document');
    expect(getConverterKind('svg', 'pdf')).toBe('document');
    expect(getConverterKind('svg', 'png')).toBe('image');
  });

  it('routes video thumbnails to ffmpeg but PDF page images to the document converter', () => {
    expect(getConverterKind('mp4', 'jpg')).toBe('media');
    expect(getConverterKind('mp4', 'png')).toBe('media');
    expect(getConverterKind('pdf', 'png')).toBe('document');
    expect(getConverterKind('pdf', 'docx')).toBe('document');
    expect(getConverterKind('html', 'docx')).toBe('document');
  });

  it('routes anything video/audio to ffmpeg', () => {
    expect(getConverterKind('mp4', 'mp3')).toBe('media');
    expect(getConverterKind('mp4', 'gif')).toBe('media');
    expect(getConverterKind('mov', 'webm')).toBe('media');
    expect(getConverterKind('mp3', 'wav')).toBe('media');
  });

  it('routes documents to the document converter', () => {
    expect(getConverterKind('docx', 'pdf')).toBe('document');
    expect(getConverterKind('docx', 'txt')).toBe('document');
    expect(getConverterKind('pdf', 'txt')).toBe('document');
    expect(getConverterKind('txt', 'pdf')).toBe('document');
  });

  it('returns undefined for invalid pairs', () => {
    expect(getConverterKind('jpg', 'mp3')).toBeUndefined();
    expect(getConverterKind('mp3', 'gif')).toBeUndefined();
    expect(getConverterKind('png', 'png')).toBeUndefined();
    expect(getConverterKind('jpg', 'svg')).toBeUndefined();
    expect(getConverterKind('mp3', 'amr')).toBeUndefined();
  });

  it('has a converter for every offered target', () => {
    for (const source of FORMAT_IDS) {
      for (const target of getTargets(source)) {
        expect(getConverterKind(source, target), `${source} to ${target}`).toBeDefined();
      }
    }
  });
});

describe('needsFFmpeg', () => {
  it('is true only for media conversions', () => {
    expect(needsFFmpeg('mp4', 'webm')).toBe(true);
    expect(needsFFmpeg('wav', 'mp3')).toBe(true);
    expect(needsFFmpeg('jpg', 'png')).toBe(false);
    expect(needsFFmpeg('docx', 'pdf')).toBe(false);
  });
});
