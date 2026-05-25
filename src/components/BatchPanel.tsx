import { useState, useRef } from 'react';
import type { ImageFile, ConversionOptions, ConversionProgress, OrientationMode } from '../types';
import { convertImages } from '../lib/converter';

interface BatchPanelProps {
  images: ImageFile[];
  options: ConversionOptions;
}

export function BatchPanel({ images, options }: BatchPanelProps) {
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [converting, setConverting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleConvert = async () => {
    if (images.length === 0) return;
    setConverting(true);
    setProgress({ current: 0, total: 0, message: 'Loading images...' });
    abortRef.current = new AbortController();

    try {
      const loaded = await Promise.all(
        images.map((img) => {
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
                URL.revokeObjectURL(img.url);
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

      const result = await convertImages(loaded, options, setProgress, abortRef.current.signal);

      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);

      setProgress({ current: 0, total: 0, message: `Done! ${result.pageCount} pages` });
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

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="batch-panel">
      {progress && progress.message && (
        <div className="batch-progress">
          <div className="progress-text">
            {progress.total > 0 ? (
              <>{progress.current}/{progress.total} slices: {progress.message}</>
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
          <button className="btn btn-danger btn-lg" onClick={handleCancel}>
            Cancel
          </button>
        ) : (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleConvert}
            disabled={images.length === 0}
          >
            Convert to XTC ({images.length})
          </button>
        )}
      </div>
    </div>
  );
}
