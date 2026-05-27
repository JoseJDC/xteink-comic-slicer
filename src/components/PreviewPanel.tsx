import { useEffect, useRef, useState, useCallback, memo } from 'react';
import type { CropSlice, OrientationMode, ConversionOptions } from '../types';
import { computeSlices, extractAndRotateSlice, extractFullPage } from '../lib/slicer';
import { applyDither } from '../lib/processing/dithering';
import { getTargetDimensions } from '../lib/processing/canvas';

interface PreviewPanelProps {
  imageUrl: string;
  imageName: string;
  orientation: OrientationMode;
  onOrientationChange: (orientation: OrientationMode) => void;
  options: ConversionOptions;
}

const SliceCanvas = memo(function SliceCanvas({ canvas }: { canvas: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    el.width = canvas.width;
    el.height = canvas.height;
    ctx.drawImage(canvas, 0, 0);
  }, [canvas]);
  return <canvas ref={ref} />;
});

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
  const [selectedSlice, setSelectedSlice] = useState(-1);
  const [previewCanvases, setPreviewCanvases] = useState<HTMLCanvasElement[]>([]);
  const [showModal, setShowModal] = useState(false);

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
    setSelectedSlice(-1);
    generatePreviews(result.slices);
  }, [naturalSize, orientation, hasNaturalSize]);

  const generatePreviews = useCallback(async (slicesToProcess: CropSlice[]) => {
    const img = imgRef.current;
    if (!img || slicesToProcess.length === 0) return;

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.naturalWidth;
    sourceCanvas.height = img.naturalHeight;
    const ctx = sourceCanvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const { width: tw, height: th } = getTargetDimensions(options.device);
    const canvases: HTMLCanvasElement[] = [];

    const fullOut = extractFullPage(sourceCanvas, tw, th);
    let fullCtx = fullOut.getContext('2d')!;
    let fullData = fullCtx.getImageData(0, 0, tw, th);
    fullData = applyDither(fullData, options.dithering, options.is2bit);
    fullCtx.putImageData(fullData, 0, 0);
    canvases.push(fullOut);

    for (const sl of slicesToProcess) {
      const out = extractAndRotateSlice(sourceCanvas, sl, tw, th);
      const outCtx = out.getContext('2d')!;
      let imageData = outCtx.getImageData(0, 0, tw, th);
      imageData = applyDither(imageData, options.dithering, options.is2bit);
      outCtx.putImageData(imageData, 0, 0);
      canvases.push(out);
    }
    setPreviewCanvases(canvases);
  }, [orientation, options.device, options.dithering, options.is2bit]);

  useEffect(() => {
    if (hasNaturalSize && slices.length > 0) {
      generatePreviews(slices);
    }
  }, [options.dithering, options.is2bit, hasNaturalSize, slices, generatePreviews]);

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
    const cctx = canvas.getContext('2d')!;
    cctx.drawImage(imgRef.current!, 0, 0, dispW, dispH);

    if (selectedSlice < 0) return;

    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      const sx = s.x * scale;
      const sy = s.y * scale;
      const sw = s.width * scale;
      const sh = s.height * scale;

      if (i === selectedSlice) {
        cctx.fillStyle = 'rgba(233, 69, 96, 0.15)';
        cctx.fillRect(sx, sy, sw, sh);
        cctx.strokeStyle = '#e94560';
        cctx.lineWidth = 3;
        cctx.strokeRect(sx, sy, sw, sh);
      } else {
        cctx.strokeStyle = '#e94560';
        cctx.lineWidth = 2;
        cctx.setLineDash([6, 3]);
        cctx.strokeRect(sx, sy, sw, sh);
        cctx.setLineDash([]);
      }

      cctx.fillStyle = '#e94560';
      cctx.font = 'bold 14px sans-serif';
      cctx.fillText(`${i + 1}`, sx + 6, sy + 18);
    }
  }, [naturalSize, slices, selectedSlice, hasNaturalSize]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal]);

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

      {previewCanvases.length > 0 && (
        <div className="slice-strip">
          {previewCanvases.map((canvas, i) => {
            const sliceIndex = i - 1;
            return (
              <div
                key={i}
                className={`slice-thumb ${sliceIndex === selectedSlice ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedSlice(sliceIndex);
                  setShowModal(true);
                }}
              >
                <SliceCanvas canvas={canvas} />
                <span className="slice-label">{i === 0 ? 'Full' : `${i}`}</span>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="slice-modal" onClick={e => e.stopPropagation()}>
            <div className="slice-modal-header">
              <span className="slice-modal-title">
                {imageName} — {selectedSlice < 0 ? 'Full page' : `Slice ${selectedSlice + 1}`}
              </span>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="slice-modal-body">
              {previewCanvases[selectedSlice < 0 ? 0 : selectedSlice + 1] && (
                <SliceCanvas canvas={previewCanvases[selectedSlice < 0 ? 0 : selectedSlice + 1]} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
