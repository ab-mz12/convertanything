/**
 * Embeds IBM Plex Sans Arabic (OFL licensed) into generated PDFs so Latin *and* Arabic text render
 * correctly. jsPDF's built-in fonts only cover Western European characters. The font files are
 * fetched lazily (once per session) from the app's own assets and cached by the service worker.
 */
import type { jsPDF } from 'jspdf';
import regularUrl from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular/IBMPlexSansArabic_400Regular.ttf?url';
import boldUrl from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold/IBMPlexSansArabic_700Bold.ttf?url';

export const DOCUMENT_FONT = 'PlexSansArabic';

interface FontFiles {
  regular: string;
  bold: string;
}

let cache: Promise<FontFiles | null> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function fetchFont(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return toBase64(await response.arrayBuffer());
}

/** Resolves to null when the fonts cannot be fetched (e.g. offline before they were cached). */
export function loadDocumentFonts(): Promise<FontFiles | null> {
  if (!cache) {
    cache = Promise.all([fetchFont(regularUrl), fetchFont(boldUrl)])
      .then(([regular, bold]) => ({ regular, bold }))
      .catch((error) => {
        console.warn('[ConvertAnything] Could not load the document font; falling back to Helvetica.', error);
        cache = null;
        return null;
      });
  }
  return cache;
}

/** Register the font family (normal/bold; italic styles map onto them) on a jsPDF document. */
export function registerDocumentFonts(doc: jsPDF, fonts: FontFiles): void {
  doc.addFileToVFS('PlexSansArabic-Regular.ttf', fonts.regular);
  doc.addFileToVFS('PlexSansArabic-Bold.ttf', fonts.bold);
  doc.addFont('PlexSansArabic-Regular.ttf', DOCUMENT_FONT, 'normal');
  doc.addFont('PlexSansArabic-Regular.ttf', DOCUMENT_FONT, 'italic');
  doc.addFont('PlexSansArabic-Bold.ttf', DOCUMENT_FONT, 'bold');
  doc.addFont('PlexSansArabic-Bold.ttf', DOCUMENT_FONT, 'bolditalic');
}
