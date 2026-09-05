export interface DownloadableFile {
  blob: Blob;
  fileName: string;
}

/** Trigger a browser download for an in-memory blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser time to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Ensures every file name in the archive is unique (`a.png`, `a (2).png`, ...). */
export function uniqueFileNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)} (${count + 1})${name.slice(dot)}` : `${name} (${count + 1})`;
  });
}

/** Bundle several results into a single ZIP (JSZip is loaded on demand). */
export async function downloadAsZip(files: DownloadableFile[], zipName = 'converted-files.zip'): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const names = uniqueFileNames(files.map((f) => f.fileName));
  files.forEach((file, i) => zip.file(names[i], file.blob));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  downloadBlob(blob, zipName);
}
