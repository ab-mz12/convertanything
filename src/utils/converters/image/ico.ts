/**
 * Minimal ICO encoder: a single-image icon whose payload is a PNG (supported by every modern
 * OS and browser since Windows Vista). ICO dimensions are limited to 256 pixels.
 */
export const ICO_HEADER_SIZE = 22;

export function encodeICO(png: Uint8Array, width: number, height: number): Uint8Array {
  if (width < 1 || height < 1 || width > 256 || height > 256) {
    throw new Error('ICO images must be between 1 and 256 pixels wide and high');
  }
  const out = new Uint8Array(ICO_HEADER_SIZE + png.length);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, 1, true); // image count
  out[6] = width === 256 ? 0 : width; // 0 means 256
  out[7] = height === 256 ? 0 : height;
  out[8] = 0; // palette colours
  out[9] = 0; // reserved
  view.setUint16(10, 1, true); // colour planes
  view.setUint16(12, 32, true); // bits per pixel
  view.setUint32(14, png.length, true);
  view.setUint32(18, ICO_HEADER_SIZE, true); // payload offset
  out.set(png, ICO_HEADER_SIZE);
  return out;
}
