// Copies the single-threaded FFmpeg WebAssembly core from node_modules into public/ffmpeg so it
// is served from our own origin (works offline, no CDN, no CORS). Runs automatically after
// `npm install`; safe to re-run at any time.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const target = join(root, 'public', 'ffmpeg');
const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

if (!existsSync(source)) {
  console.warn('[copy-ffmpeg-core] @ffmpeg/core is not installed; skipping.');
  process.exit(0);
}

mkdirSync(target, { recursive: true });
for (const file of files) {
  const from = join(source, file);
  const to = join(target, file);
  copyFileSync(from, to);
  const mb = (statSync(to).size / 1024 / 1024).toFixed(1);
  console.log(`[copy-ffmpeg-core] ${file} → public/ffmpeg/ (${mb} MB)`);
}
