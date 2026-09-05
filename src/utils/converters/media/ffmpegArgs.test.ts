import { describe, expect, it } from 'vitest';
import { FORMAT_IDS, FORMATS, getTargets } from '../../formats';
import { buildFFmpegAttempts, describeFFmpegError, transcodeArgs } from './ffmpegArgs';

describe('transcodeArgs', () => {
  it('extracts audio with the right encoder and drops video', () => {
    const args = transcodeArgs('mp3', 'in.mp4', 'out.mp3');
    expect(args).toContain('-vn');
    expect(args).toContain('libmp3lame');
    expect(args.at(-1)).toBe('out.mp3');
    expect(transcodeArgs('wav', 'in.mp4', 'out.wav')).toContain('pcm_s16le');
    expect(transcodeArgs('ogg', 'in.mp3', 'out.ogg')).toContain('libvorbis');
    expect(transcodeArgs('m4a', 'in.mp3', 'out.m4a')).toContain('aac');
    expect(transcodeArgs('flac', 'in.wav', 'out.flac')).toContain('flac');
  });

  it('encodes MP4/MOV as H.264 + AAC with even dimensions and faststart', () => {
    for (const target of ['mp4', 'mov'] as const) {
      const args = transcodeArgs(target, 'in.webm', `out.${target}`);
      expect(args).toEqual(expect.arrayContaining(['libx264', 'aac', 'yuv420p', '+faststart']));
      expect(args.join(' ')).toContain('scale=trunc(iw/2)*2:trunc(ih/2)*2');
    }
  });

  it('encodes WebM as VP8 + Vorbis and AVI as MPEG-4 + MP3', () => {
    expect(transcodeArgs('webm', 'in.mp4', 'out.webm')).toEqual(expect.arrayContaining(['libvpx', 'libvorbis']));
    expect(transcodeArgs('avi', 'in.mp4', 'out.avi')).toEqual(expect.arrayContaining(['mpeg4', 'libmp3lame']));
  });

  it('builds a palette-based looping GIF without audio', () => {
    const args = transcodeArgs('gif', 'in.mp4', 'out.gif');
    expect(args).toContain('-an');
    expect(args.join(' ')).toContain('palettegen');
    expect(args.join(' ')).toContain('paletteuse');
    const loop = args.indexOf('-loop');
    expect(args.slice(loop, loop + 2)).toEqual(['-loop', '0']);
  });

  it('starts with -y -i <input> and ends with <output>', () => {
    const args = transcodeArgs('mkv', 'movie.mov', 'movie.mkv');
    expect(args.slice(0, 3)).toEqual(['-y', '-i', 'movie.mov']);
    expect(args.at(-1)).toBe('movie.mkv');
  });

  it('throws for targets ffmpeg is not responsible for', () => {
    expect(() => transcodeArgs('png', 'a', 'b')).toThrow(/No FFmpeg recipe/);
  });

  it('has a recipe for every media target', () => {
    for (const source of FORMAT_IDS) {
      if (FORMATS[source].category !== 'video' && FORMATS[source].category !== 'audio') continue;
      for (const target of getTargets(source)) {
        expect(() => transcodeArgs(target, 'in', 'out')).not.toThrow();
      }
    }
  });
});

describe('buildFFmpegAttempts', () => {
  it('tries a stream copy first for MP4-family containers', () => {
    const attempts = buildFFmpegAttempts('mp4', 'mov', 'in.mp4', 'out.mov');
    expect(attempts).toHaveLength(2);
    expect(attempts[0].args).toEqual(expect.arrayContaining(['-c', 'copy']));
    expect(attempts[0].args).not.toContain('libx264');
    expect(attempts[1].args).toContain('libx264');
  });

  it('always tries a stream copy into MKV', () => {
    expect(buildFFmpegAttempts('webm', 'mkv', 'in.webm', 'out.mkv')[0].args).toEqual(
      expect.arrayContaining(['-c', 'copy']),
    );
    expect(buildFFmpegAttempts('avi', 'mkv', 'in.avi', 'out.mkv')[0].args).toEqual(
      expect.arrayContaining(['-c', 'copy']),
    );
  });

  it('goes straight to transcoding when a copy cannot work', () => {
    expect(buildFFmpegAttempts('webm', 'mp4', 'in.webm', 'out.mp4')).toHaveLength(1);
    expect(buildFFmpegAttempts('mp4', 'webm', 'in.mp4', 'out.webm')).toHaveLength(1);
    expect(buildFFmpegAttempts('mp4', 'mp3', 'in.mp4', 'out.mp3')).toHaveLength(1);
    expect(buildFFmpegAttempts('mp4', 'gif', 'in.mp4', 'out.gif')).toHaveLength(1);
    expect(buildFFmpegAttempts('wav', 'mp3', 'in.wav', 'out.mp3')).toHaveLength(1);
  });
});

describe('describeFFmpegError', () => {
  it('recognises corrupted input', () => {
    expect(describeFFmpegError(['in.mp4: Invalid data found when processing input'], 1)).toMatch(/corrupted/i);
    expect(describeFFmpegError(['[mov,mp4,m4a] moov atom not found'], 1)).toMatch(/corrupted/i);
  });
  it('recognises missing streams', () => {
    expect(describeFFmpegError(['Output file #0 does not contain any stream'], 1)).toMatch(/no audio track/i);
  });
  it('recognises unsupported codecs', () => {
    expect(describeFFmpegError(["Unknown encoder 'libfoo'"], 1)).toMatch(/not supported/i);
  });
  it('falls back to the exit code and last meaningful log line', () => {
    const message = describeFFmpegError(['frame=  12 fps=0.0', 'Something odd happened'], 187);
    expect(message).toContain('187');
    expect(message).toContain('Something odd happened');
  });
});
