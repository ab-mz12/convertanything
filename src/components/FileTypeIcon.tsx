import { FileQuestion, FileText, Film, Image as ImageIcon, Music, type LucideIcon } from 'lucide-react';
import type { Category } from '../utils/formats';

const ICONS: Record<Category, LucideIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
};

const TONES: Record<Category, string> = {
  image: 'bg-sky-500/15 text-sky-500',
  video: 'bg-violet-500/15 text-violet-500',
  audio: 'bg-emerald-500/15 text-emerald-500',
  document: 'bg-amber-500/15 text-amber-500',
};

interface FileTypeIconProps {
  category?: Category;
  extension?: string;
}

export function FileTypeIcon({ category, extension }: FileTypeIconProps) {
  const Icon = category ? ICONS[category] : FileQuestion;
  const tone = category ? TONES[category] : 'bg-slate-500/15 text-slate-400';
  return (
    <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`} aria-hidden="true">
      <Icon size={20} />
      {extension && (
        <span className="absolute -bottom-1 -right-1 rounded bg-slate-900 px-1 py-px text-[9px] font-bold uppercase leading-tight text-white dark:bg-slate-100 dark:text-slate-900">
          {extension.slice(0, 4)}
        </span>
      )}
    </span>
  );
}
