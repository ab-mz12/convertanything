interface ProgressBarProps {
  /** 0..1, or null for an indeterminate animation. */
  value: number | null;
  className?: string;
}

export function ProgressBar({ value, className = '' }: ProgressBarProps) {
  const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      aria-valuetext={percent === null ? 'Working' : `${percent}%`}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${className}`}
    >
      {percent === null ? (
        <div className="h-full w-1/4 animate-indeterminate rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
      ) : (
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  );
}
