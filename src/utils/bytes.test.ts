import { describe, expect, it } from 'vitest';
import { formatBytes, percentChange } from './bytes';

describe('formatBytes', () => {
  it('formats with sensible precision', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB');
    expect(formatBytes(123_456_789)).toBe('118 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.00 GB');
  });
  it('handles garbage', () => {
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('percentChange', () => {
  it('computes a signed, rounded percentage', () => {
    expect(percentChange(100, 50)).toBe(-50);
    expect(percentChange(100, 125)).toBe(25);
    expect(percentChange(3, 3)).toBe(0);
    expect(percentChange(0, 10)).toBe(0);
  });
});
