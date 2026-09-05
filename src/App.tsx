import { useRef } from 'react';
import { DropZone } from './components/DropZone';
import { FileList } from './components/FileList';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { useConversionQueue } from './hooks/useConversionQueue';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { downloadBlob } from './utils/download';

export default function App() {
  const { theme, toggle } = useTheme();
  const [settings, updateSettings] = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const queue = useConversionQueue({
    getOptions: () => ({ imageQuality: settingsRef.current.imageQuality }),
    onDone: (_item, result) => {
      if (settingsRef.current.autoDownload) downloadBlob(result.blob, result.fileName);
    },
  });

  const hasFiles = queue.items.length > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header theme={theme} onToggleTheme={toggle} settings={settings} onUpdateSettings={updateSettings} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 sm:px-6">
        <Hero compact={hasFiles} />
        <DropZone onFiles={queue.addFiles} compact={hasFiles} />
        {hasFiles && <FileList queue={queue} />}
      </main>
      <Footer />
    </div>
  );
}
