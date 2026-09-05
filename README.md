# ConvertAnything

A browser-based, fully client-side file converter. Drop in images, video, audio or documents, pick a
target format, and download the result. **Nothing is ever uploaded**: every conversion runs inside
your browser using WebAssembly and JavaScript, so it works offline after the first load and your
files never leave your device.

## Features

- **Drag & drop or browse**, multi-file batches, automatic type detection (magic bytes first, then
  extension and MIME type) with a warning when a file's extension lies about its content.
- **Only valid targets are offered.** A JPG can become PNG/WebP/GIF/BMP/AVIF/PDF; it will never be
  offered as MP3.
- **Queue with live status** per file: Ready → Queued → Converting (%) → Done / Failed. Files are
  processed one at a time so a batch of large videos does not exhaust memory.
- **Real progress bars** (FFmpeg progress events, pdf.js page counts) and a clear, per-file error
  message when something goes wrong. One bad file never takes down the batch.
- **Download** per file, **Download all as ZIP**, optional auto-download, and a before/after size
  comparison for every result.
- **Cancel / remove** individual files (even mid-conversion) or clear everything.
- Dark mode by default with a light-mode toggle, image quality setting, fully responsive layout.
- **Lazy loading**: the ~32 MB FFmpeg core is fetched only when a video/audio conversion starts.
  pdf.js, jsPDF, mammoth and the AVIF codec are separate chunks loaded on demand.
- **Offline**: a service worker precaches the app shell and lazy chunks; the FFmpeg core is cached
  the first time it is downloaded.

## Supported conversions

| Input | Outputs |
| --- | --- |
| **Images** JPG, PNG, WebP, GIF, BMP, AVIF, SVG, ICO | JPG, PNG, WebP, GIF, BMP, AVIF, ICO (favicon), or a PDF page |
| **Video** MP4, MOV, WebM, AVI, MKV, FLV, 3GP, WMV, MPEG, MPEG-TS | any of those containers, animated GIF, a JPG/PNG thumbnail, or audio-only MP3 / WAV / OGG / Opus / M4A / AAC / FLAC / AIFF / WMA |
| **Audio** MP3, WAV, OGG, Opus, M4A, AAC, FLAC, AIFF, WMA, AMR | MP3, WAV, OGG, Opus, M4A, AAC, FLAC, AIFF, WMA |
| **Word (DOCX)** | PDF (Latin + Arabic text, right-to-left aware), TXT, HTML |
| **PDF** | TXT, DOCX (text only), PNG / JPG page images (multi-page PDFs become a ZIP) |
| **Text** (`.txt`, `.md`, `.log`, `.csv`) | PDF, DOCX, HTML |
| **HTML** | PDF, DOCX, TXT |

SVG and AMR are input-only (no browser-side encoder). Video → MPEG uses MPEG-2, video → WMV uses WMV2/WMA.

## How it works

| Category | Engine | Where it runs |
| --- | --- | --- |
| Images | Browser codecs via `createImageBitmap` + `OffscreenCanvas`; hand-written BMP encoder; [gifenc](https://github.com/mattdesl/gifenc) for GIF; [@jsquash/avif](https://github.com/jamsinclair/jSquash) (WASM) for AVIF | Web Worker (main-thread fallback for old browsers) |
| Video / audio | [ffmpeg.wasm](https://ffmpegwasm.netlify.app/) single-threaded core (libx264, libvpx, libmp3lame, libvorbis, AAC, FLAC, mpeg4) | FFmpeg's own Web Worker |
| DOCX / HTML | [mammoth](https://github.com/mwilliamson/mammoth.js) to HTML/text, `DOMParser` to a block model, then a small flow-layout engine on top of [jsPDF](https://github.com/parallax/jsPDF) | Main thread |
| → DOCX | [docx](https://github.com/dolanmiu/docx) | Main thread |
| PDF → TXT / DOCX / images | [pdf.js](https://mozilla.github.io/pdf.js/) (text layer and page rendering) | pdf.js Web Worker + canvas |
| TXT / image → PDF | jsPDF | Main thread |
| ZIP | [JSZip](https://stuk.github.io/jszip/) | Main thread |

Video conversions try a lossless **remux** (`-c copy`) first whenever the container pair allows
it (MP4 ↔ MOV ↔ MKV) and fall back to re-encoding only if FFmpeg refuses. Re-encoding uses
`libx264 -preset ultrafast` for MP4/MOV/MKV, VP8 for WebM, and a two-pass palette for GIFs.

## Running locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install        # also copies the FFmpeg core into public/ffmpeg (postinstall)
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm test           # unit tests (vitest): detection, routing, ffmpeg args, encoders
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
```

## Deploying

The output is a plain static site (`dist/`). There is no backend and no environment configuration.

- **Vercel**: import the repo; the Vite preset is detected automatically (`vercel.json` only adds
  cache headers). Build command `npm run build`, output directory `dist`.
- **Netlify**: `netlify.toml` is included (build `npm run build`, publish `dist`).
- **GitHub Pages**: `.github/workflows/deploy.yml` builds and publishes the site on every push to
  `main` (Settings → Pages → Source must be "GitHub Actions"; the workflow enables it on first run).
  The workflow sets `VITE_BASE_PATH=/<repo-name>/` so assets resolve under the project URL.
- **Anything else** (S3, nginx…): run `npm run build` and upload `dist/`. Make sure
  `.wasm` files are served with `Content-Type: application/wasm`. If you host under a sub-path,
  set `base` in `vite.config.ts`.

### Optional: faster FFmpeg with multi-threading

The app ships the single-threaded FFmpeg core because it works on any static host. The
multi-threaded core (`@ffmpeg/core-mt`) is several times faster but needs `SharedArrayBuffer`, which
browsers only enable when the page is served with:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Add those headers on your host, install `@ffmpeg/core-mt`, point `scripts/copy-ffmpeg-core.mjs`
at it and pass `workerURL` in `ffmpegLoader.ts`.

## Project structure

```
convertanything/
├── index.html                    # applies saved theme before first paint
├── vite.config.ts                # React, Tailwind v4, PWA/service worker, worker settings
├── scripts/copy-ffmpeg-core.mjs  # copies @ffmpeg/core into public/ffmpeg after npm install
├── public/
│   ├── favicon.svg
│   └── ffmpeg/                   # generated, git-ignored: ffmpeg-core.js + .wasm
└── src/
    ├── App.tsx
    ├── components/               # Header, Hero, DropZone, FileList, FileRow, ProgressBar, ...
    ├── hooks/
    │   ├── useConversionQueue.ts # reducer + one-at-a-time scheduler, cancellation
    │   ├── useSettings.ts        # auto-download, image quality (localStorage)
    │   └── useTheme.ts           # dark/light toggle (localStorage)
    └── utils/
        ├── formats.ts            # format registry + which targets are valid for which source
        ├── detect.ts             # magic-byte / extension / MIME detection
        ├── routing.ts            # source+target → converter family
        ├── download.ts           # download helpers + ZIP
        └── converters/
            ├── index.ts          # lazy dispatcher
            ├── types.ts          # ConversionRequest / Result / Error
            ├── image/            # imageCore (shared), image.worker, bmp, gif, ico
            ├── document/         # pdfWriter + blocksToPdf (jsPDF layout), docx/pdf/txt/html converters, toDocx, pdfToImages
            └── media/            # ffmpegArgs (pure, tested), ffmpegLoader, mediaConverter
```

Tests live next to the code as `*.test.ts` and run in Node (no browser needed).

## Privacy

- No network requests are made after the page and its assets load, apart from lazily fetching the
  app's own code chunks and the FFmpeg core from the same origin.
- No analytics, no cookies, no third-party scripts, no CDN.
- Converted files live in browser memory only until you download them or close the tab.

## Limitations

- **Memory**: everything is held in RAM. ffmpeg.wasm keeps the input, the output and its working
  memory inside a 32-bit WebAssembly heap, so very large videos (roughly > 1 GB, less on phones)
  can fail with an out-of-memory error. Files of a few hundred MB work on a typical laptop.
- **Speed**: software H.264/VP8 encoding in WebAssembly is much slower than native FFmpeg; expect
  a few frames per second for 1080p. Remuxing and audio conversions are fast.
- **PDF output embeds IBM Plex Sans Arabic** (Latin + Arabic, with proper letter joining and
  right-to-left layout via [bidi-js](https://github.com/lojjic/bidi-js)). Other scripts (CJK,
  Cyrillic, Hebrew shaping is basic) and emoji are not covered; the app warns when it detects them.
  Inline formatting (bold/italic, links) is not preserved in DOCX → PDF; headings, lists, tables
  and images are. Word headers/footers (e.g. a logo in the page header) are not included.
- **PDF → TXT / DOCX** extract the text layer only (no layout, fonts or images). Scanned PDFs need OCR, which is not included.
- **HTML → PDF / DOCX** keeps the text structure (headings, lists, tables, inline data-URI images) but not CSS styling, and never fetches remote images.
- **Animated GIF → image** uses the first frame. **Video → GIF** is limited to 12 fps and 480 px
  wide to keep file sizes reasonable.
- **AVIF encoding** is slow for large images (it is a WASM build of libavif).
- **DOC (legacy Word), XLSX, PPTX, HEIC** are not supported.
