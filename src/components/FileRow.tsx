import { AlertTriangle, ArrowRight, Download, Play, RotateCcw, X } from 'lucide-react';
import type { QueueItem } from '../hooks/useConversionQueue';
import { formatBytes, percentChange } from '../utils/bytes';
import { getExtension } from '../utils/detect';
import { CATEGORY_LABEL, FORMATS, getTargets, type Category, type FormatId } from '../utils/formats';
import { downloadBlob } from '../utils/download';
import { FileTypeIcon } from './FileTypeIcon';
import { FormatSelect } from './FormatSelect';
import { ProgressBar } from './ProgressBar';
import { StatusBadge } from './StatusBadge';

interface FileRowProps {
  item: QueueItem;
  /** How many other restartable files share this file's category (enables "apply to all"). */
  siblingCount: number;
  onSetTarget: (id: string, target: FormatId) => void;
  onSetTargetForCategory: (category: Category, target: FormatId) => void;
  onConvert: (id: string) => void;
  onRemove: (id: string) => void;
}

export function FileRow({ item, siblingCount, onSetTarget, onSetTargetForCategory, onConvert, onRemove }: FileRowProps) {
  const detection = item.detection;
  const format = detection?.format;
  const targets = format ? getTargets(format.id) : [];
  const busy = item.status === 'converting' || item.status === 'queued';
  const extension = getExtension(item.file.name) || format?.extensions[0];

  return (
    <li className="card p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Identity */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <FileTypeIcon category={format?.category} extension={extension} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={item.file.name}>
              {item.file.name}
            </p>
            <p className="muted mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
              <span>{formatBytes(item.file.size)}</span>
              <span aria-hidden="true">·</span>
              <span>{format ? format.label : 'Unknown type'}</span>
              {detection?.extensionMismatch && (
                <span
                  className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                  title={`The file extension says .${extension}, but the content is ${format?.label}. We use the content.`}
                >
                  <AlertTriangle size={11} /> extension mismatch
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Target */}
        {format && targets.length > 0 && (
          <div className="flex items-center gap-2">
            <ArrowRight size={16} className="muted hidden shrink-0 sm:block" />
            <label className="muted text-xs sm:hidden">Convert to</label>
            <FormatSelect
              value={item.target}
              options={targets}
              disabled={busy}
              onChange={(target) => onSetTarget(item.id, target)}
            />
            {siblingCount > 0 && item.target && !busy && (
              <button
                type="button"
                className="muted text-xs underline decoration-dotted underline-offset-2 hover:text-indigo-500"
                onClick={() => onSetTargetForCategory(format.category, item.target as FormatId)}
                title={`Use ${FORMATS[item.target].label} for every ${CATEGORY_LABEL[format.category].toLowerCase()} file`}
              >
                apply to all
              </button>
            )}
          </div>
        )}

        {/* Status + actions */}
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <StatusBadge status={item.status} progress={item.progress} />
          <div className="flex items-center gap-1">
            {item.status === 'ready' && (
              <button type="button" className="btn-primary" onClick={() => onConvert(item.id)}>
                <Play size={14} /> Convert
              </button>
            )}
            {item.status === 'failed' && (
              <button type="button" className="btn-secondary" onClick={() => onConvert(item.id)}>
                <RotateCcw size={14} /> Retry
              </button>
            )}
            {item.status === 'done' && item.result && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => item.result && downloadBlob(item.result.blob, item.result.fileName)}
              >
                <Download size={14} /> Download
              </button>
            )}
            <button
              type="button"
              className="btn-icon"
              onClick={() => onRemove(item.id)}
              aria-label={busy ? `Cancel and remove ${item.file.name}` : `Remove ${item.file.name}`}
              title={busy ? 'Cancel' : 'Remove'}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {item.status === 'converting' && (
        <div className="mt-3">
          <ProgressBar value={item.progress} />
          {item.stage && <p className="muted mt-1.5 truncate text-xs">{item.stage}</p>}
        </div>
      )}

      {item.status === 'done' && item.result && <SizeComparison before={item.file.size} after={item.result.size} />}

      {item.status === 'done' && item.result?.warning && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {item.result.warning}
        </p>
      )}

      {item.status === 'failed' && item.error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <p>{item.error.message}</p>
          {item.error.details && (
            <details className="mt-1.5">
              <summary className="cursor-pointer opacity-80">Technical details</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] opacity-80">
                {item.error.details}
              </pre>
            </details>
          )}
        </div>
      )}

      {item.status === 'unsupported' && (
        <p className="muted mt-2 text-xs">
          This file type can’t be converted here. Supported inputs: images (JPG, PNG, WebP, GIF, BMP, AVIF),
          video (MP4, MOV, WebM, AVI, MKV), audio (MP3, WAV, OGG, M4A, FLAC), PDF, DOCX and plain text.
        </p>
      )}
    </li>
  );
}

function SizeComparison({ before, after }: { before: number; after: number }) {
  const change = percentChange(before, after);
  const tone =
    change < 0
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
      : change > 0
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
        : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return (
    <p className="muted mt-2 flex flex-wrap items-center gap-2 text-xs tabular-nums">
      <span>
        {formatBytes(before)} <ArrowRight size={11} className="inline" aria-label="to" /> {formatBytes(after)}
      </span>
      <span className={`badge ${tone}`}>
        {change > 0 ? '+' : ''}
        {change}%
      </span>
    </p>
  );
}
