import { useEffect, useRef, useState, useCallback } from 'react';
import type { CropSlice, OrientationMode, ConversionOptions } from '../types';
import { computeSlices, extractAndRotateSlice } from '../lib/slicer';
import { applyDither } from '../lib/processing/dithering';
import { getTargetDimensions } from '../lib/processing/canvas';

interface PreviewPanelProps {
  imageUrl: string;
  imageName: string;
  orientation: OrientationMode;
  onOrientationChange: (orientation: OrientationMode) => void;
  options: ConversionOptions;
}

export function PreviewPanel({
  imageUrl,
  imageName,
  orientation,
  onOrientationChange,
  options,
}: PreviewPanelProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [slices, setSlices] = useState<CropSlice[]>([]);
  const [selectedSlice, setSelectedSlice] = useState(0);
  const [slicePreviews, setSlicePreviews] = useState<string[]>([]);

  const hasNaturalSize = naturalSize.width > 0 && naturalSize.height > 0;

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    if (img.complete) {
      onLoad();
    } else {
      img.addEventListener('load', onLoad);
      return () => img.removeEventListener('load', onLoad);
    }
  }, [imageUrl]);

  useEffect(() => {
    if (!hasNaturalSize) return;
    const result = computeSlices(naturalSize.width, naturalSize.height, orientation);
    setSlices(result.slices);
    setSelectedSlice(0);
    generateSlicePreviews(result.slices);
  }, [naturalSize, orientation, hasNaturalSize]);

  const generateSlicePreviews = useCallback(async (slices: CropSlice[]) => {
    const img = imgRef.current;
    if (!img) return;

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.naturalWidth;
    sourceCanvas.height = img.naturalHeight;
    const ctx = sourceCanvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const { width: tw, height: th } = getTargetDimensions(options.device);

    const previews: string[] = [];
    for (const slice of slices) {
      const out = extractAndRotateSlice(sourceCanvas, slice, tw, th);
      const outCtx = out.getContext('2d')!;
      let imageData = outCtx.getImageData(0, 0, tw, th);
      imageData = applyDither(imageData, options.dithering, options.is2bit);
      outCtx.putImageData(imageData, 0, 0);
      previews.push(out.toDataURL('image/png'));
    }
    setSlicePreviews(previews);
  }, [orientation, options]);

  useEffect(() => {
    if (hasNaturalSize && slices.length > 0) {
      generateSlicePreviews(slices);
    }
  }, [options.dithering, options.is2bit, hasNaturalSize, slices.length]);

  const drawOverlay = useCallback(() => {
    if (!canvasRef.current || !hasNaturalSize) return;
    const canvas = canvasRef.current;
    const container = canvas.parentElement!;
    const maxW = container.clientWidth - 40;
    const maxH = container.clientHeight - 60;
    const imgW = naturalSize.width;
    const imgH = naturalSize.height;
    const scale = Math.min(maxW / imgW, maxH / imgH, 1);
    const dispW = Math.round(imgW * scale);
    const dispH = Math.round(imgH * scale);

    canvas.width = dispW;
    canvas.height = dispH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imgRef.current!, 0, 0, dispW, dispH);

    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);

    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      const sx = s.x * scale;
      const sy = s.y * scale;
      const sw = s.width * scale;
      const sh = s.height * scale;

      if (i === selectedSlice) {
        ctx.fillStyle = 'rgba(233, 69, 96, 0.15)';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.setLineDash([]);
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeRect(sx, sy, sw, sh);
      }

      ctx.fillStyle = '#e94560';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${i + 1}`, sx + 6, sy + 18);
    }
  }, [naturalSize, slices, selectedSlice, hasNaturalSize]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <h3 className="preview-title">{imageName}</h3>
        <div className="preview-orientation">
          <button
            className={`btn btn-sm ${orientation === 'portrait' ? 'active' : ''}`}
            onClick={() => onOrientationChange('portrait')}
          >
            ↕ Portrait
          </button>
          <button
            className={`btn btn-sm ${orientation === 'landscape' ? 'active' : ''}`}
            onClick={() => onOrientationChange('landscape')}
          >
            ↔ Landscape
          </button>
        </div>
      </div>

      <img ref={imgRef} src={imageUrl} alt="" style={{ display: 'none' }} />

      <div className="preview-canvas-container">
        {hasNaturalSize && (
          <>
            <canvas ref={canvasRef} className="preview-canvas" />
            {slices.length > 1 && (
              <div className="preview-slice-info">
                {naturalSize.width}×{naturalSize.height} → {slices.length} slices × {slices[0]?.width}×{slices[0]?.height}
              </div>
            )}
          </>
        )}
        {!hasNaturalSize && (
          <div className="preview-loading">Loading image...</div>
        )}
      </div>

      {slicePreviews.length > 0 && (
        <div className="slice-strip">
          {slicePreviews.map((url, i) => (
            <div
              key={i}
              className={`slice-thumb ${i === selectedSlice ? 'selected' : ''}`}
              onClick={() => setSelectedSlice(i)}
            >
              <img src={url} alt={`Slice ${i + 1}`} />
              <span className="slice-label">{i + 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
