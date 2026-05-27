import { useState, useRef, memo } from 'react';
import type { ImageFile, ConversionOptions, ConversionProgress, OrientationMode } from '../types';
import { convertImages } from '../lib/converter';

interface BatchPanelProps {
  images: ImageFile[];
  options: ConversionOptions;
  mergeMode: 'single' | 'separate';
}

interface SourceGroup {
  title: string;
  images: ImageFile[];
}

function groupBySource(images: ImageFile[]): SourceGroup[] {
  const groups = new Map<string, ImageFile[]>();

  for (const img of images) {
    const key = img.source || '__individual__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(img);
  }

  const result: SourceGroup[] = [];
  for (const [source, imgs] of groups) {
    if (source === '__individual__') {
      const title = imgs.length === 1
        ? imgs[0].name.replace(/\.[^.]+$/, '')
        : 'comic';
      result.push({ title, images: imgs });
    } else {
      result.push({ title: source, images: imgs });
    }
  }
  return result;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const BatchPanel = memo(function BatchPanel({ images, options, mergeMode }: BatchPanelProps) {
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [converting, setConverting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const doConvert = async (groups: SourceGroup[]) => {
    setConverting(true);
    abortRef.current = new AbortController();

    setProgress({ current: 0, total: groups.length, message: `Converting ${groups.length} file(s)\u2026` });

    try {
      for (let g = 0; g < groups.length; g++) {
        if (abortRef.current?.signal.aborted) break;
        const group = groups[g];

        setProgress({
          current: g,
          total: groups.length,
          message: `Loading images for "${group.title}"\u2026`,
        });

        const loaded = await Promise.all(
          group.images.map((img) => {
            return new Promise<{ canvas: HTMLCanvasElement; name: string; orientation: OrientationMode }>(
              (resolve, reject) => {
                const el = new Image();
                el.crossOrigin = 'anonymous';
                el.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = el.naturalWidth;
                  canvas.height = el.naturalHeight;
                  const ctx = canvas.getContext('2d')!;
                  ctx.drawImage(el, 0, 0);
                  resolve({ canvas, name: img.name, orientation: img.orientation });
                };
                el.onerror = () => {
                  reject(new Error(`Failed to load: ${img.name}`));
                };
                if (img.url.startsWith('blob:') || img.url.startsWith('http')) {
                  el.src = img.url;
                } else {
                  fetch(img.url)
                    .then((r) => r.blob())
                    .then((b) => { el.src = URL.createObjectURL(b); });
                }
              }
            );
          })
        );

        if (abortRef.current?.signal.aborted) break;

        const result = await convertImages(
          loaded, options, setProgress, abortRef.current.signal, group.title
        );

        triggerDownload(result.blob, result.filename);
      }

      if (!abortRef.current?.signal.aborted) {
        setProgress({ current: groups.length, total: groups.length, message: 'Done!' });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setProgress({ current: 0, total: 0, message: 'Cancelled' });
      } else {
        setProgress({ current: 0, total: 0, message: `Error: ${err.message}` });
      }
    } finally {
      setConverting(false);
      abortRef.current = null;
    }
  };

  const handleConvertClick = () => {
    if (images.length === 0) return;
    const groups = groupBySource(images);
    if (mergeMode === 'single') {
      const allImages = groups.flatMap((g) => g.images);
      doConvert([{ title: 'comic', images: allImages }]);
    } else {
      doConvert(groups);
    }
  };

  const handleCancelConvert = () => {
    abortRef.current?.abort();
  };

  const srcCount = groupBySource(images).length;

  return (
    <div className="batch-panel">
      {progress && progress.message && (
        <div className="batch-progress" aria-live="polite">
          <div className="progress-text">
            {progress.total > 0 ? (
              <>{progress.current}/{progress.total}: {progress.message}</>
            ) : (
              <>{progress.message}</>
            )}
          </div>
          {progress.total > 0 && (
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="batch-actions">
        {converting ? (
          <button className="btn btn-danger btn-lg" onClick={handleCancelConvert}>
            Cancel
          </button>
        ) : (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleConvertClick}
            disabled={images.length === 0}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 11V4M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 10v1.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Convert to XTC ({srcCount > 1 ? `${srcCount} files` : `${images.length} images`})
          </button>
        )}
      </div>

    </div>
  );
});
