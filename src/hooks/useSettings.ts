import { useCallback, useEffect, useState } from 'react';

export interface Settings {
  /** Download each file automatically as soon as it is converted. */
  autoDownload: boolean;
  /** 0.5 .. 1 quality for lossy image formats. */
  imageQuality: number;
}

export const DEFAULT_SETTINGS: Settings = { autoDownload: false, imageQuality: 0.92 };

const STORAGE_KEY = 'ca-settings';

function sanitize(value: unknown): Partial<Settings> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  const result: Partial<Settings> = {};
  if (typeof record.autoDownload === 'boolean') result.autoDownload = record.autoDownload;
  if (typeof record.imageQuality === 'number' && record.imageQuality >= 0.5 && record.imageQuality <= 1) {
    result.imageQuality = record.imageQuality;
  }
  return result;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...sanitize(JSON.parse(raw)) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch })), []);
  return [settings, update];
}
