import { describe, expect, it } from 'vitest';
import { BMP_HEADER_SIZE, encodeBMP } from './bmp';

describe('encodeBMP', () => {
  it('writes a valid 24-bit bottom-up bitmap', () => {
    // 2x2 image: top row red, blue; bottom row green, white.
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, /**/ 0, 0, 255, 255,
      0, 255, 0, 255, /**/ 255, 255, 255, 255,
    ]);
    const bmp = encodeBMP({ width: 2, height: 2, data });
    const view = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);

    expect(String.fromCharCode(bmp[0], bmp[1])).toBe('BM');
    const rowSize = 8; // 2 px x 3 bytes = 6, padded to 8
    expect(view.getUint32(2, true)).toBe(BMP_HEADER_SIZE + rowSize * 2);
    expect(view.getUint32(10, true)).toBe(BMP_HEADER_SIZE);
    expect(view.getInt32(18, true)).toBe(2);
    expect(view.getInt32(22, true)).toBe(2);
    expect(view.getUint16(28, true)).toBe(24);
    expect(bmp.length).toBe(BMP_HEADER_SIZE + rowSize * 2);

    // First stored row is the bottom row, pixels stored as B,G,R.
    const bottom = Array.from(bmp.slice(BMP_HEADER_SIZE, BMP_HEADER_SIZE + 6));
    expect(bottom).toEqual([0, 255, 0, /**/ 255, 255, 255]);
    const top = Array.from(bmp.slice(BMP_HEADER_SIZE + rowSize, BMP_HEADER_SIZE + rowSize + 6));
    expect(top).toEqual([0, 0, 255, /**/ 255, 0, 0]);
  });

  it('pads rows to 4 bytes', () => {
    const bmp = encodeBMP({ width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) });
    expect(bmp.length).toBe(BMP_HEADER_SIZE + 4);
  });

  it('rejects empty images', () => {
    expect(() => encodeBMP({ width: 0, height: 0, data: new Uint8ClampedArray() })).toThrow();
  });
});
