/**
 * Main-thread entry point for image conversions. Work happens in a dedicated Web Worker
 * (OffscreenCanvas) so large images never block the UI; browsers without OffscreenCanvas fall
 * back to a regular canvas on the main thread.
 */
import { outputFileName } from '../../formats';
import { ConversionError, abortError, type ConversionRequest, type ConversionResult } from '../types';
import { MAIN_THREAD_SOURCES, convertImageCore, type ImageJob, type ImageWorkerRequest, type ImageWorkerResponse } from './imageCore';

let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<number, { resolve: (blob: Blob) => void; reject: (error: unknown) => void }>();

export function canUseImageWorker(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap === 'function' &&
    typeof OffscreenCanvas.prototype.convertToBlob === 'function'
  );
}

function disposeWorker(): void {
  worker?.terminate();
  worker = null;
}

function failAll(error: unknown): void {
  for (const entry of pending.values()) entry.reject(error);
  pending.clear();
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const instance = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' });
  instance.onmessage = (event: MessageEvent<ImageWorkerResponse>) => {
    const message = event.data;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.ok) entry.resolve(message.blob);
    else entry.reject(new ConversionError(message.message, message.details));
  };
  instance.onerror = (event) => {
    failAll(new ConversionError('The image worker crashed.', event.message));
    disposeWorker();
  };
  worker = instance;
  return instance;
}

function runInWorker(job: ImageJob, signal: AbortSignal): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const id = ++sequence;
    const onAbort = () => {
      pending.delete(id);
      // Terminating is the only way to interrupt a busy worker; a fresh one is spawned next time.
      disposeWorker();
      reject(abortError());
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    pending.set(id, {
      resolve: (blob) => {
        signal.removeEventListener('abort', onAbort);
        resolve(blob);
      },
      reject: (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    });
    const request: ImageWorkerRequest = { id, job };
    ensureWorker().postMessage(request);
  });
}

export async function convertImage(request: ConversionRequest): Promise<ConversionResult> {
  const job: ImageJob = {
    file: request.file,
    source: request.source,
    target: request.target,
    quality: request.options.imageQuality,
  };
  request.onProgress(null, 'Converting');
  const useWorker = canUseImageWorker() && !MAIN_THREAD_SOURCES.has(request.source);
  const blob = useWorker ? await runInWorker(job, request.signal) : await convertImageCore(job);
  request.onProgress(1, 'Done');
  return { blob, fileName: outputFileName(request.file.name, request.target) };
}
