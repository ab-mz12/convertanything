import { Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { acceptAttribute } from '../utils/formats';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  compact: boolean;
}

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

export function DropZone({ onFiles, compact }: DropZoneProps) {
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Files can be dropped anywhere on the page, not just on the zone itself.
  useEffect(() => {
    let depth = 0;
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth++;
      setActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setActive(false);
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) onFiles(Array.from(files));
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [onFiles]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Add files: drag and drop, or press Enter to browse"
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        }
      }}
      className={[
        'group relative flex w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 text-center outline-none transition-all',
        'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-950',
        compact ? 'py-8' : 'py-14 sm:py-20',
        active
          ? 'scale-[1.01] border-indigo-500 bg-indigo-500/10'
          : 'border-slate-300 bg-white/70 hover:border-indigo-400 hover:bg-indigo-500/5 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-indigo-500',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptAttribute()}
        className="sr-only"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) onFiles(Array.from(files));
          event.target.value = '';
        }}
      />
      <span
        className={`grid place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30 transition-transform group-hover:scale-105 ${
          compact ? 'h-11 w-11' : 'h-14 w-14'
        }`}
      >
        <Upload size={compact ? 20 : 26} />
      </span>
      <p className={`font-semibold ${compact ? 'mt-3 text-base' : 'mt-5 text-lg'}`}>
        {active ? 'Drop to add files' : compact ? 'Add more files' : 'Drag & drop files here'}
      </p>
      <p className="muted mt-1 text-sm">
        or <span className="font-medium text-indigo-500 underline decoration-indigo-500/40 underline-offset-2">browse your device</span>
        {!compact && <span className="hidden sm:inline"> · images, video, audio, PDF, DOCX, TXT</span>}
      </p>
    </div>
  );
}
