/**
 * Lazily loads ffmpeg.wasm (≈32 MB core) the first time a media conversion is requested and keeps
 * a single instance alive for the rest of the session. The core is served from our own origin
 * (see scripts/copy-ffmpeg-core.mjs) so no CDN is involved and the app keeps working offline
 * once it has been cached by the service worker.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg';

export type LoadProgress = (loadedBytes: number, totalBytes: number | null) => void;

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

function coreBaseUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}ffmpeg/`, self.location.href).href;
}

async function fetchWithProgress(url: string, onProgress?: LoadProgress): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  if (!response.body || !onProgress) return response.blob();

  // Content-Length is the compressed size when the server gzips the response; treat it as a hint.
  const total = Number(response.headers.get('content-length')) || null;
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as unknown as ArrayBuffer);
    received += value.byteLength;
    onProgress(received, total);
  }
  return new Blob(chunks, { type: 'application/wasm' });
}

export function getFFmpeg(onProgress?: LoadProgress): Promise<FFmpeg> {
  if (instance) return Promise.resolve(instance);
  if (!loading) {
    loading = (async () => {
      const [{ FFmpeg }, wasmBlob] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        fetchWithProgress(`${coreBaseUrl()}ffmpeg-core.wasm`, onProgress),
      ]);
      const wasmURL = URL.createObjectURL(wasmBlob);
      const ffmpeg = new FFmpeg();
      try {
        await ffmpeg.load({ coreURL: `${coreBaseUrl()}ffmpeg-core.js`, wasmURL });
      } finally {
        URL.revokeObjectURL(wasmURL);
      }
      instance = ffmpeg;
      return ffmpeg;
    })();
    loading.then(
      () => {
        loading = null;
      },
      () => {
        loading = null;
      },
    );
  }
  return loading;
}

/** Kills the current instance (also aborts any running command). The next call reloads it. */
export function resetFFmpeg(): void {
  try {
    instance?.terminate();
  } catch {
    // already dead
  }
  instance = null;
}

export function isFFmpegLoaded(): boolean {
  return instance !== null;
}
