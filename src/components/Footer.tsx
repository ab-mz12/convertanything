export function Footer() {
  return (
    <footer className="border-t border-slate-200/70 py-6 dark:border-slate-800/70">
      <div className="muted mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 px-4 text-center text-xs sm:flex-row sm:px-6 sm:text-left">
        <p>ConvertAnything runs entirely in your browser. No servers, no uploads, no tracking.</p>
        <p>Powered by ffmpeg.wasm, pdf.js, mammoth and jsPDF.</p>
      </div>
    </footer>
  );
}
