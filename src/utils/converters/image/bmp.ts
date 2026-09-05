/**
 * Minimal 24-bit BMP encoder (BITMAPINFOHEADER, bottom-up, BI_RGB). Browsers can decode BMP but
 * `canvas.toBlob('image/bmp')` is not supported anywhere, so we write the bytes ourselves.
 * Alpha is dropped; callers flatten onto white first.
 */
export const BMP_HEADER_SIZE = 54;

export function encodeBMP(image: { width: number; height: number; data: Uint8ClampedArray | Uint8Array }): Uint8Array {
  const { width, height, data } = image;
  if (width <= 0 || height <= 0) throw new Error('Cannot encode an empty image as BMP');

  const rowSize = Math.floor((24 * width + 31) / 32) * 4; // rows are padded to 4 bytes
  const pixelArraySize = rowSize * height;
  const fileSize = BMP_HEADER_SIZE + pixelArraySize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);

  // BITMAPFILEHEADER
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true); // reserved
  view.setUint32(10, BMP_HEADER_SIZE, true); // pixel data offset

  // BITMAPINFOHEADER
  view.setUint32(14, 40, true); // header size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive height = bottom-up rows
  view.setUint16(26, 1, true); // colour planes
  view.setUint16(28, 24, true); // bits per pixel
  view.setUint32(30, 0, true); // BI_RGB, no compression
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); // 72 DPI horizontal (pixels per metre)
  view.setInt32(42, 2835, true); // 72 DPI vertical
  view.setUint32(46, 0, true); // colours in palette
  view.setUint32(50, 0, true); // important colours

  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 4;
    let dst = BMP_HEADER_SIZE + y * rowSize;
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * 4;
      out[dst++] = data[s + 2]; // B
      out[dst++] = data[s + 1]; // G
      out[dst++] = data[s]; // R
    }
  }
  return out;
}
