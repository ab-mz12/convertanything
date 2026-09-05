import type { FormatId } from '../formats';

export interface ConversionOptions {
  /** 0..1 quality for lossy image outputs (JPEG, WebP, AVIF). */
  imageQuality: number;
}

/** `ratio` is 0..1, or null when progress cannot be measured (indeterminate). */
export type ProgressCallback = (ratio: number | null, stage?: string) => void;

export interface ConversionRequest {
  file: File;
  source: FormatId;
  target: FormatId;
  options: ConversionOptions;
  onProgress: ProgressCallback;
  signal: AbortSignal;
}

export interface ConversionResult {
  blob: Blob;
  fileName: string;
  /** Non-fatal caveat to show the user (e.g. "no text layer found"). */
  warning?: string;
}

/** A conversion failure with a user-facing message and optional technical details (logs). */
export class ConversionError extends Error {
  readonly details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = 'ConversionError';
    this.details = details;
  }
}

export function abortError(): DOMException {
  return new DOMException('Conversion cancelled', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

/** Normalise any thrown value into a ConversionError (abort errors pass through untouched). */
export function toConversionError(error: unknown, fallbackMessage: string): Error {
  if (isAbortError(error)) return error as Error;
  if (error instanceof ConversionError) return error;
  const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return new ConversionError(fallbackMessage, details);
}
