import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/; the deploy workflow sets this. Vercel/Netlify use '/'.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ConvertAnything',
        short_name: 'ConvertAnything',
        description: 'Convert images, video, audio and documents privately in your browser. Nothing is uploaded.',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // The app shell and the lazy JS chunks (pdf.js, jsPDF, mammoth, ...) are precached so the
        // app works offline after the first visit. The big WebAssembly binaries (FFmpeg core
        // ~31 MB, AVIF codecs ~3.5 MB each) are not downloaded up front; they are cached the
        // first time a conversion needs them and served from cache afterwards.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: ['ffmpeg/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && (url.pathname.includes('/ffmpeg/') || url.pathname.endsWith('.wasm')),
            handler: 'CacheFirst',
            options: { cacheName: 'wasm-engines', expiration: { maxEntries: 8 } },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    // Both packages spawn workers / load .wasm relative to their own files; esbuild
    // pre-bundling would break those relative URLs in dev.
    exclude: ['@ffmpeg/ffmpeg', '@jsquash/avif'],
  },
  worker: {
    // The image worker lazy-loads the AVIF codec, which needs code-splitting (ES output).
    format: 'es',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
