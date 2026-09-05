import { describe, expect, it } from 'vitest';
import { ICO_HEADER_SIZE, encodeICO } from './ico';

describe('encodeICO', () => {
  it('wraps a PNG payload in a valid single-image ICO header', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const ico = encodeICO(png, 32, 16);
    const view = new DataView(ico.buffer);
    expect(ico.length).toBe(ICO_HEADER_SIZE + png.length);
    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(1);
    expect(ico[6]).toBe(32);
    expect(ico[7]).toBe(16);
    expect(view.getUint16(12, true)).toBe(32);
    expect(view.getUint32(14, true)).toBe(png.length);
    expect(view.getUint32(18, true)).toBe(ICO_HEADER_SIZE);
    expect(Array.from(ico.slice(ICO_HEADER_SIZE))).toEqual(Array.from(png));
  });

  it('encodes 256 px as 0 per the ICO spec and rejects larger images', () => {
    expect(encodeICO(new Uint8Array(1), 256, 256)[6]).toBe(0);
    expect(() => encodeICO(new Uint8Array(1), 300, 300)).toThrow();
  });
});
