import { Settings2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { Settings } from '../hooks/useSettings';

interface SettingsMenuProps {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

export function SettingsMenu({ settings, onUpdate }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const qualityId = useId();
  const autoId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const qualityPercent = Math.round(settings.imageQuality * 100);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="btn-icon"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
      >
        <Settings2 size={18} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Settings"
          className="card absolute right-0 top-11 z-30 w-72 p-4 shadow-xl"
        >
          <h2 className="text-sm font-semibold">Settings</h2>

          <label htmlFor={autoId} className="mt-4 flex cursor-pointer items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Auto-download</span>
              <span className="muted block text-xs">Save each file as soon as it is converted.</span>
            </span>
            <input
              id={autoId}
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
              checked={settings.autoDownload}
              onChange={(event) => onUpdate({ autoDownload: event.target.checked })}
            />
          </label>

          <div className="mt-4">
            <label htmlFor={qualityId} className="flex items-center justify-between text-sm font-medium">
              <span>Image quality</span>
              <span className="muted tabular-nums">{qualityPercent}%</span>
            </label>
            <input
              id={qualityId}
              type="range"
              min={50}
              max={100}
              step={1}
              value={qualityPercent}
              onChange={(event) => onUpdate({ imageQuality: Number(event.target.value) / 100 })}
              className="mt-2 w-full accent-indigo-600"
            />
            <p className="muted mt-1 text-xs">Applies to JPEG, WebP and AVIF output.</p>
          </div>
        </div>
      )}
    </div>
  );
}
