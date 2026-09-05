import { describe, expect, it } from 'vitest';
import { uniqueFileNames } from './download';

describe('uniqueFileNames', () => {
  it('leaves unique names alone', () => {
    expect(uniqueFileNames(['a.png', 'b.png'])).toEqual(['a.png', 'b.png']);
  });
  it('numbers duplicates, case-insensitively, keeping the extension', () => {
    expect(uniqueFileNames(['a.png', 'a.png', 'b.txt', 'A.PNG'])).toEqual(['a.png', 'a (2).png', 'b.txt', 'A (3).PNG']);
  });
  it('handles names without an extension', () => {
    expect(uniqueFileNames(['README', 'README'])).toEqual(['README', 'README (2)']);
  });
});
