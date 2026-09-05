import { AlertCircle, CheckCircle2, Clock, HelpCircle, Loader2, type LucideIcon } from 'lucide-react';
import type { FileStatus } from '../hooks/useConversionQueue';

const STYLE: Record<FileStatus, string> = {
  unsupported: 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  ready: 'bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  queued: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  converting: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

const ICON: Partial<Record<FileStatus, LucideIcon>> = {
  unsupported: HelpCircle,
  queued: Clock,
  converting: Loader2,
  done: CheckCircle2,
  failed: AlertCircle,
};

const LABEL: Record<FileStatus, string> = {
  unsupported: 'Unsupported',
  ready: 'Ready',
  queued: 'Queued',
  converting: 'Converting',
  done: 'Done',
  failed: 'Failed',
};

interface StatusBadgeProps {
  status: FileStatus;
  progress: number | null;
}

export function StatusBadge({ status, progress }: StatusBadgeProps) {
  const Icon = ICON[status];
  const label =
    status === 'converting' && progress !== null ? `${LABEL[status]} ${Math.round(progress * 100)}%` : LABEL[status];
  return (
    <span className={`badge whitespace-nowrap tabular-nums ${STYLE[status]}`} role="status">
      {Icon && <Icon size={12} className={status === 'converting' ? 'animate-spin' : undefined} />}
      {label}
    </span>
  );
}
