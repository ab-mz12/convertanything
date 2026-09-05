/**
 * The DOM typings only accept `Uint8Array<ArrayBuffer>` as a BlobPart, while most libraries hand
 * back `Uint8Array<ArrayBufferLike>`. Browsers accept either at runtime.
 */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as unknown as ArrayBuffer], { type });
}
