import { FileArchive, Loader2, Play, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ConversionQueue } from '../hooks/useConversionQueue';
import { downloadAsZip } from '../utils/download';
import type { Category } from '../utils/formats';
import { FileRow } from './FileRow';

export function FileList({ queue }: { queue: ConversionQueue }) {
  const { items, counts } = queue;
  const [zipping, setZipping] = useState(false);

  const doneItems = items.filter((item) => item.status === 'done' && item.result);

  // Files per category that can still have their target changed, for the "apply to all" affordance.
  const restartableByCategory = useMemo(() => {
    const map = new Map<Category, number>();
    for (const item of items) {
      const category = item.detection?.format.category;
      if (!category || !(item.status === 'ready' || item.status === 'done' || item.status === 'failed')) continue;
      map.set(category, (map.get(category) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const summary = [
    `${counts.total} ${counts.total === 1 ? 'file' : 'files'}`,
    counts.converting > 0 && 'converting',
    counts.queued > 0 && `${counts.queued} queued`,
    counts.done > 0 && `${counts.done} done`,
    counts.failed > 0 && `${counts.failed} failed`,
  ]
    .filter(Boolean)
    .join(' · ');

  const zipAll = async () => {
    setZipping(true);
    try {
      await downloadAsZip(doneItems.map((item) => item.result!));
    } finally {
      setZipping(false);
    }
  };

  return (
    <section className="mt-6" aria-label="Files">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="muted text-sm" aria-live="polite">
          {summary}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {counts.ready > 0 && (
            <button type="button" className="btn-primary" onClick={queue.convertAll}>
              <Play size={14} />
              Convert all{counts.ready > 1 ? ` (${counts.ready})` : ''}
            </button>
          )}
          {doneItems.length > 1 && (
            <button type="button" className="btn-secondary" onClick={zipAll} disabled={zipping}>
              {zipping ? <Loader2 size={14} className="animate-spin" /> : <FileArchive size={14} />}
              Download all (.zip)
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={queue.clear}>
            <Trash2 size={14} /> Clear all
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            siblingCount={Math.max(0, (restartableByCategory.get(item.detection?.format.category as Category) ?? 0) - 1)}
            onSetTarget={queue.setTarget}
            onSetTargetForCategory={queue.setTargetForCategory}
            onConvert={(id) => queue.convert([id])}
            onRemove={queue.remove}
          />
        ))}
      </ul>
    </section>
  );
}
