/**
 * Pure functions that build FFmpeg command lines. Kept free of browser APIs so they can be unit
 * tested. The single-threaded ffmpeg.wasm core ships libx264, libvpx, libmp3lame, libvorbis,
 * the native AAC/FLAC/PCM encoders and the mpeg4 encoder.
 */
import { FORMATS, type FormatId } from '../../formats';

export interface FFmpegAttempt {
  /** Shown to the user while the attempt runs. */
  label: string;
  args: string[];
}

/** Containers that can usually hold each other's streams (H.264/AAC) without re-encoding. */
const MP4_FAMILY = new Set<FormatId>(['mp4', 'mov', 'mkv']);

/** Keeps the first video stream and (if present) the first audio stream; drops subtitles/data. */
const VIDEO_MAPPING = ['-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn'];

/** Ensures even dimensions, which yuv420p (the compatible pixel format) requires. */
const EVEN_DIMENSIONS = ['-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'];

const H264_AAC = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'];

/**
 * Ordered list of FFmpeg invocations to try. A cheap stream copy ("remux") is attempted first
 * whenever the container pair allows it; if FFmpeg rejects it, the full transcode runs.
 */
export function buildFFmpegAttempts(source: FormatId, target: FormatId, input: string, output: string): FFmpegAttempt[] {
  const attempts: FFmpegAttempt[] = [];
  const isVideoSource = FORMATS[source].category === 'video';

  if (isVideoSource && (target === 'mkv' || (MP4_FAMILY.has(source) && MP4_FAMILY.has(target)))) {
    const faststart = target === 'mkv' ? [] : ['-movflags', '+faststart'];
    attempts.push({
      label: 'Remuxing (no re-encode)',
      args: ['-y', '-i', input, ...VIDEO_MAPPING, '-c', 'copy', ...faststart, output],
    });
  }

  attempts.push({ label: 'Converting', args: transcodeArgs(target, input, output) });
  return attempts;
}

export function transcodeArgs(target: FormatId, input: string, output: string): string[] {
  const base = ['-y', '-i', input];
  switch (target) {
    case 'mp4':
    case 'mov':
      return [...base, ...VIDEO_MAPPING, ...EVEN_DIMENSIONS, ...H264_AAC, '-movflags', '+faststart', output];
    case 'mkv':
      return [...base, ...VIDEO_MAPPING, ...EVEN_DIMENSIONS, ...H264_AAC, output];
    case 'webm':
      // VP8 is several times faster than VP9 in WebAssembly and universally supported.
      return [
        ...base,
        ...VIDEO_MAPPING,
        '-c:v', 'libvpx', '-b:v', '1.5M', '-deadline', 'realtime', '-cpu-used', '8',
        '-c:a', 'libvorbis', '-q:a', '4',
        output,
      ];
    case 'avi':
      return [...base, ...VIDEO_MAPPING, '-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'libmp3lame', '-q:a', '4', output];
    case 'gif':
      // Two-pass palette for good colours; 12 fps and max 480px wide keeps file sizes sane.
      return [
        ...base,
        '-map', '0:v:0', '-an', '-sn', '-dn',
        '-vf',
        'fps=12,scale=min(480\\,iw):-2:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
        '-loop', '0',
        output,
      ];
    case 'mp3':
      return [...base, '-vn', '-sn', '-dn', '-c:a', 'libmp3lame', '-q:a', '2', output];
    case 'wav':
      return [...base, '-vn', '-sn', '-dn', '-c:a', 'pcm_s16le', output];
    case 'ogg':
      return [...base, '-vn', '-sn', '-dn', '-c:a', 'libvorbis', '-q:a', '5', output];
    case 'm4a':
      return [...base, '-vn', '-sn', '-dn', '-c:a', 'aac', '-b:a', '192k', output];
    case 'flac':
      return [...base, '-vn', '-sn', '-dn', '-c:a', 'flac', output];
    default:
      throw new Error(`No FFmpeg recipe for target "${target}"`);
  }
}

/** Translate FFmpeg's stderr into a short, human-readable explanation. */
export function describeFFmpegError(logs: readonly string[], exitCode: number): string {
  const text = logs.join('\n');
  if (/Invalid data found when processing input|moov atom not found|Could not find codec parameters|Header missing|Error splitting the argument list|Invalid argument/i.test(text)) {
    return 'The file appears to be corrupted or is not a valid media file.';
  }
  if (/does not contain any stream|Stream map .* matches no streams|Output file is empty/i.test(text)) {
    return 'No suitable stream was found. For example, the video may have no audio track.';
  }
  if (/Unknown encoder|Encoder .* not found|codec not currently supported in container|Could not find tag for codec/i.test(text)) {
    return 'This codec is not supported by the in-browser encoder.';
  }
  if (/Decoder .* not found|No decoder for|Unsupported codec|Unknown decoder/i.test(text)) {
    return 'The input uses a codec that cannot be decoded in the browser.';
  }
  if (/Cannot allocate memory|out of memory|memory access out of bounds|allocation failed/i.test(text)) {
    return 'The browser ran out of memory. Try a smaller file.';
  }
  const lastLine = [...logs].reverse().find((line) => line.trim() && !/^\s*(frame|size)=/.test(line));
  return `FFmpeg exited with code ${exitCode}${lastLine ? `: ${lastLine.trim()}` : ''}`;
}
