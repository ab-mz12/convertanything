/**
 * State + scheduler for the file list. Files are converted strictly one at a time (a queue) so a
 * batch of large videos never exhausts browser memory. Everything runs in the browser.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { convertFile } from '../utils/converters';
import { isAbortError, type ConversionOptions, type ConversionResult } from '../utils/converters/types';
import { detectFile, type Detection } from '../utils/detect';
import { defaultTarget, getTargets, type Category, type FormatId } from '../utils/formats';
import { uid } from '../utils/id';

export type FileStatus = 'unsupported' | 'ready' | 'queued' | 'converting' | 'done' | 'failed';

export interface QueueResult extends ConversionResult {
  size: number;
}

export interface QueueItem {
  id: string;
  file: File;
  /** Undefined when the file type could not be identified. */
  detection?: Detection;
  target?: FormatId;
  status: FileStatus;
  /** 0..1, or null for indeterminate. */
  progress: number | null;
  /** Human readable sub-step ("Downloading FFmpeg engine · 12 MB / 32 MB"). */
  stage?: string;
  result?: QueueResult;
  error?: { message: string; details?: string };
}

type Action =
  | { type: 'ADD'; items: QueueItem[] }
  | { type: 'SET_TARGET'; id: string; target: FormatId }
  | { type: 'SET_TARGET_FOR_CATEGORY'; category: Category; target: FormatId }
  | { type: 'QUEUE'; ids: string[] }
  | { type: 'START'; id: string }
  | { type: 'PROGRESS'; id: string; progress: number | null; stage?: string }
  | { type: 'DONE'; id: string; result: QueueResult }
  | { type: 'FAIL'; id: string; error: { message: string; details?: string } }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' };

/** Statuses from which the user may change the target and (re)start a conversion. */
const RESTARTABLE = new Set<FileStatus>(['ready', 'done', 'failed']);

function patch(state: QueueItem[], id: string, update: (item: QueueItem) => QueueItem): QueueItem[] {
  return state.map((item) => (item.id === id ? update(item) : item));
}

function withTarget(item: QueueItem, target: FormatId): QueueItem {
  return { ...item, target, status: 'ready', progress: null, stage: undefined, result: undefined, error: undefined };
}

export function queueReducer(state: QueueItem[], action: Action): QueueItem[] {
  switch (action.type) {
    case 'ADD':
      return [...state, ...action.items];
    case 'SET_TARGET':
      return patch(state, action.id, (item) => (RESTARTABLE.has(item.status) ? withTarget(item, action.target) : item));
    case 'SET_TARGET_FOR_CATEGORY':
      return state.map((item) =>
        item.detection?.format.category === action.category &&
        RESTARTABLE.has(item.status) &&
        getTargets(item.detection.format.id).includes(action.target)
          ? withTarget(item, action.target)
          : item,
      );
    case 'QUEUE': {
      const ids = new Set(action.ids);
      return state.map((item) =>
        ids.has(item.id) && (item.status === 'ready' || item.status === 'failed') && item.target
          ? { ...item, status: 'queued', progress: null, stage: undefined, result: undefined, error: undefined }
          : item,
      );
    }
    case 'START':
      return patch(state, action.id, (item) => ({ ...item, status: 'converting', progress: null, stage: 'Starting' }));
    case 'PROGRESS':
      return patch(state, action.id, (item) =>
        item.status === 'converting' ? { ...item, progress: action.progress, stage: action.stage ?? item.stage } : item,
      );
    case 'DONE':
      return patch(state, action.id, (item) => ({ ...item, status: 'done', progress: 1, stage: undefined, result: action.result }));
    case 'FAIL':
      return patch(state, action.id, (item) => ({ ...item, status: 'failed', progress: null, stage: undefined, error: action.error }));
    case 'REMOVE':
      return state.filter((item) => item.id !== action.id);
    case 'CLEAR':
      return [];
  }
}

export interface UseConversionQueueOptions {
  getOptions: () => ConversionOptions;
  onDone?: (item: QueueItem, result: ConversionResult) => void;
}

export function useConversionQueue(options: UseConversionQueueOptions) {
  const [items, dispatch] = useReducer(queueReducer, []);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const activeRef = useRef<string | null>(null);
  const controllersRef = useRef(new Map<string, AbortController>());

  // Scheduler: whenever nothing is converting, start the next queued item.
  useEffect(() => {
    if (activeRef.current) return;
    const next = items.find((item) => item.status === 'queued');
    if (!next?.detection || !next.target) return;

    const { id } = next;
    const controller = new AbortController();
    activeRef.current = id;
    controllersRef.current.set(id, controller);
    dispatch({ type: 'START', id });

    let lastDispatch = 0;
    let lastStage: string | undefined;
    const onProgress = (ratio: number | null, stage?: string) => {
      const now = performance.now();
      const stageChanged = stage !== undefined && stage !== lastStage;
      // FFmpeg reports progress very frequently; ~12 updates a second is plenty for the UI.
      if (!stageChanged && ratio !== null && ratio < 1 && now - lastDispatch < 80) return;
      lastDispatch = now;
      lastStage = stage ?? lastStage;
      dispatch({ type: 'PROGRESS', id, progress: ratio, stage });
    };

    const finish = () => {
      activeRef.current = null;
      controllersRef.current.delete(id);
    };

    convertFile({
      file: next.file,
      source: next.detection.format.id,
      target: next.target,
      options: optionsRef.current.getOptions(),
      onProgress,
      signal: controller.signal,
    })
      .then((result) => {
        finish();
        if (controller.signal.aborted || !itemsRef.current.some((item) => item.id === id)) return;
        dispatch({ type: 'DONE', id, result: { ...result, size: result.blob.size } });
        optionsRef.current.onDone?.(next, result);
      })
      .catch((error: unknown) => {
        finish();
        if (controller.signal.aborted || isAbortError(error)) return;
        dispatch({
          type: 'FAIL',
          id,
          error: {
            message: error instanceof Error ? error.message : String(error),
            details: (error as { details?: string })?.details,
          },
        });
      });
  }, [items]);

  const addFiles = useCallback(async (files: Iterable<File>) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const newItems = await Promise.all(
      list.map(async (file): Promise<QueueItem> => {
        let detection: Detection | undefined;
        try {
          detection = await detectFile(file);
        } catch {
          detection = undefined;
        }
        const target = detection ? defaultTarget(detection.format.id) : undefined;
        return {
          id: uid(),
          file,
          detection,
          target,
          status: detection && target ? 'ready' : 'unsupported',
          progress: null,
        };
      }),
    );
    dispatch({ type: 'ADD', items: newItems });
  }, []);

  const setTarget = useCallback((id: string, target: FormatId) => dispatch({ type: 'SET_TARGET', id, target }), []);

  const setTargetForCategory = useCallback(
    (category: Category, target: FormatId) => dispatch({ type: 'SET_TARGET_FOR_CATEGORY', category, target }),
    [],
  );

  const convert = useCallback((ids: string[]) => dispatch({ type: 'QUEUE', ids }), []);

  const convertAll = useCallback(() => {
    dispatch({ type: 'QUEUE', ids: itemsRef.current.filter((item) => item.status === 'ready').map((item) => item.id) });
  }, []);

  const remove = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    dispatch({ type: 'REMOVE', id });
  }, []);

  const clear = useCallback(() => {
    for (const controller of controllersRef.current.values()) controller.abort();
    controllersRef.current.clear();
    dispatch({ type: 'CLEAR' });
  }, []);

  const counts = useMemo(() => {
    const result: Record<FileStatus, number> & { total: number } = {
      total: items.length,
      unsupported: 0,
      ready: 0,
      queued: 0,
      converting: 0,
      done: 0,
      failed: 0,
    };
    for (const item of items) result[item.status]++;
    return result;
  }, [items]);

  return { items, counts, addFiles, setTarget, setTargetForCategory, convert, convertAll, remove, clear };
}

export type ConversionQueue = ReturnType<typeof useConversionQueue>;
