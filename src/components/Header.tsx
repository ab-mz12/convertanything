import { Moon, Sun, Zap } from 'lucide-react';
import type { Settings } from '../hooks/useSettings';
import type { Theme } from '../hooks/useTheme';
import { SettingsMenu } from './SettingsMenu';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  settings: Settings;
  onUpdateSettings: (patch: Partial<Settings>) => void;
}

export function Header({ theme, onToggleTheme, settings, onUpdateSettings }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/70">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30">
            <Zap size={16} strokeWidth={2.5} />
          </span>
          <span className="text-base">
            Convert<span className="text-indigo-500">Anything</span>
          </span>
        </a>
        <div className="flex items-center gap-1">
          <SettingsMenu settings={settings} onUpdate={onUpdateSettings} />
          <button
            type="button"
            className="btn-icon"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
