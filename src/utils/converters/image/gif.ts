import { GIFEncoder, applyPalette, quantize } from 'gifenc';

/**
 * Encode a single still frame as a GIF. Colours are quantised to a 256-entry palette. The caller
 * flattens transparency onto white beforehand (GIF only supports 1-bit transparency).
 */
export function encodeGIF(image: { width: number; height: number; data: Uint8ClampedArray }): Uint8Array {
  const { width, height, data } = image;
  const palette = quantize(data, 256, { format: 'rgb565' });
  const index = applyPalette(data, palette, 'rgb565');
  const gif = GIFEncoder();
  gif.writeFrame(index, width, height, { palette });
  gif.finish();
  return gif.bytes();
}
