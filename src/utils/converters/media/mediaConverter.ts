import { formatBytes } from '../../bytes';
import { bytesToBlob } from '../../blob';
import { getExtension } from '../../detect';
import { extensionFor, mimeFor, outputFileName } from '../../formats';
import {
  ConversionError,
  abortError,
  isAbortError,
  throwIfAborted,
  type ConversionRequest,
  type ConversionResult,
} from '../types';
import { buildFFmpegAttempts, describeFFmpegError } from './ffmpegArgs';
import { getFFmpeg, resetFFmpeg } from './ffmpegLoader';

const MAX_LOG_LINES = 400;

export async function convertMedia(request: ConversionRequest): Promise<ConversionResult> {
  const { file, source, target, onProgress, signal } = request;
  throwIfAborted(signal);

  onProgress(null, 'Loading FFmpeg engine');
  const ffmpeg = await getFFmpeg((loaded, total) => {
    const ratio = total ? Math.min(loaded / total, 0.99) : null;
    const size = total ? `${formatBytes(loaded)} / ${formatBytes(total)}` : formatBytes(loaded);
    onProgress(ratio, `Downloading FFmpeg engine · ${size}`);
  }).catch((error) => {
    throw new ConversionError('Could not load the FFmpeg engine. Check your connection and try again.', String(error));
  });
  throwIfAborted(signal);

  const inputName = `input.${getExtension(file.name) || extensionFor(source)}`;
  const outputName = `output.${extensionFor(target)}`;
  const logs: string[] = [];
  let stage = 'Converting';

  const onLog = ({ message }: { message: string }) => {
    logs.push(message);
    if (logs.length > MAX_LOG_LINES) logs.shift();
  };
  const onFFmpegProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) onProgress(Math.min(Math.max(progress, 0), 0.99), stage);
  };
  // Terminating the worker is the only way to interrupt FFmpeg mid-command.
  const onAbort = () => resetFFmpeg();

  ffmpeg.on('log', onLog);
  ffmpeg.on('progress', onFFmpegProgress);
  signal.addEventListener('abort', onAbort, { once: true });

  try {
    onProgress(null, 'Reading file');
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));

    let exitCode = -1;
    for (const attempt of buildFFmpegAttempts(source, target, inputName, outputName)) {
      throwIfAborted(signal);
      logs.length = 0;
      stage = attempt.label;
      onProgress(0, stage);
      exitCode = await ffmpeg.exec(attempt.args);
      if (exitCode === 0) break;
      await ffmpeg.deleteFile(outputName).catch(() => undefined);
    }
    if (exitCode !== 0) {
      throw new ConversionError(describeFFmpegError(logs, exitCode), logs.slice(-25).join('\n'));
    }

    const data = await ffmpeg.readFile(outputName);
    if (typeof data === 'string' || data.byteLength === 0) {
      throw new ConversionError('FFmpeg produced an empty file.', logs.slice(-25).join('\n'));
    }
    onProgress(1, 'Done');
    return { blob: bytesToBlob(data, mimeFor(target)), fileName: outputFileName(file.name, target) };
  } catch (error) {
    if (signal.aborted || isAbortError(error)) throw abortError();
    if (error instanceof ConversionError) throw error;
    // Anything else means the WASM instance is probably wedged (e.g. out of memory): recycle it.
    resetFFmpeg();
    throw new ConversionError(
      'The converter crashed while processing this file. It may be too large for the browser to handle.',
      `${String(error)}\n${logs.slice(-25).join('\n')}`,
    );
  } finally {
    signal.removeEventListener('abort', onAbort);
    ffmpeg.off('log', onLog);
    ffmpeg.off('progress', onFFmpegProgress);
    if (!signal.aborted) {
      await ffmpeg.deleteFile(inputName).catch(() => undefined);
      await ffmpeg.deleteFile(outputName).catch(() => undefined);
    }
  }
}
