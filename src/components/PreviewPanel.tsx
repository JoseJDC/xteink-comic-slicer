import { useEffect, useRef, useState, useCallback, memo } from 'react';
import type { CropSlice, OrientationMode, ConversionOptions } from '../types';
import { computeSlices, extractAndRotateSlice, extractFullPage } from '../lib/slicer';
import { applyDither } from '../lib/processing/dithering';
import { getTargetDimensions } from '../lib/processing/canvas';

interface PreviewPanelProps {
  imageUrl: string;
  imageName: string;
  orientation: OrientationMode;
  skipSlicing: boolean;
  rotation: 0 | 90 | 180 | 270;
  spoilerBlur: boolean;
  onSkipSlicingChange: (skip: boolean) => void;
  onRotationChange: (rotation: 0 | 90 | 180 | 270) => void;
  onSpoilerBlurChange: (blur: boolean) => void;
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
  skipSlicing,
  rotation,
  spoilerBlur,
  onSkipSlicingChange,
  onRotationChange,
  onSpoilerBlurChange,
  options,
}: PreviewPanelProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [slices, setSlices] = useState<CropSlice[]>([]);
  const [selectedSlice, setSelectedSlice] = useState(-1);
  const [previewCanvases, setPreviewCanvases] = useState<HTMLCanvasElement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [hoveredThumb, setHoveredThumb] = useState(-2);
  const [originalCanvases, setOriginalCanvases] = useState<HTMLCanvasElement[]>([]);
  const [showOriginal, setShowOriginal] = useState(false);
  const rotatedCache = useRef<{ rotation: number; canvas: HTMLCanvasElement } | null>(null);

  const hasNaturalSize = naturalSize.width > 0 && naturalSize.height > 0;

  const effW = (rotation === 90 || rotation === 270) ? naturalSize.height : naturalSize.width;
  const effH = (rotation === 90 || rotation === 270) ? naturalSize.width : naturalSize.height;

  function getRotatedImage(): HTMLCanvasElement {
    const img = imgRef.current;
    if (!img) return document.createElement('canvas');
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (rotation === 0) {
      if (rotatedCache.current?.rotation === 0 && rotatedCache.current.canvas.width === srcW) {
        return rotatedCache.current.canvas;
      }
      const c = document.createElement('canvas');
      c.width = srcW; c.height = srcH;
      c.getContext('2d')!.drawImage(img, 0, 0);
      rotatedCache.current = { rotation: 0, canvas: c };
      return c;
    }
    if (rotatedCache.current?.rotation === rotation) {
      return rotatedCache.current.canvas;
    }
    const sideways = rotation === 90 || rotation === 270;
    const c = document.createElement('canvas');
    c.width = sideways ? srcH : srcW;
    c.height = sideways ? srcW : srcH;
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.drawImage(img, -srcW / 2, -srcH / 2);
    ctx.restore();
    rotatedCache.current = { rotation, canvas: c };
    return c;
  }

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => {
      rotatedCache.current = null;
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
    rotatedCache.current = null;
  }, [rotation]);

  useEffect(() => {
    if (!hasNaturalSize) return;
    const result = computeSlices(effW, effH, orientation);
    setSlices(result.slices);
    setSelectedSlice(-1);
    generatePreviews(result.slices);
  }, [naturalSize, orientation, rotation, hasNaturalSize]);

  const generatePreviews = useCallback(async (slicesToProcess: CropSlice[]) => {
    const img = imgRef.current;
    if (!img) return;

    const sourceCanvas = getRotatedImage();

    const { width: tw, height: th } = getTargetDimensions(options.device);
    const canvases: HTMLCanvasElement[] = [];
    const originals: HTMLCanvasElement[] = [];

    const fullOut = extractFullPage(sourceCanvas, tw, th);
    const fullOrig = document.createElement('canvas');
    fullOrig.width = fullOut.width;
    fullOrig.height = fullOut.height;
    fullOrig.getContext('2d')!.drawImage(fullOut, 0, 0);
    originals.push(fullOrig);
    let fullCtx = fullOut.getContext('2d')!;
    let fullData = fullCtx.getImageData(0, 0, tw, th);
    fullData = applyDither(fullData, options.dithering, options.is2bit);
    fullCtx.putImageData(fullData, 0, 0);
    canvases.push(fullOut);

    for (const sl of slicesToProcess) {
      const out = extractAndRotateSlice(sourceCanvas, sl, tw, th);
      const orig = document.createElement('canvas');
      orig.width = out.width;
      orig.height = out.height;
      orig.getContext('2d')!.drawImage(out, 0, 0);
      originals.push(orig);
      const outCtx = out.getContext('2d')!;
      let imageData = outCtx.getImageData(0, 0, tw, th);
      imageData = applyDither(imageData, options.dithering, options.is2bit);
      outCtx.putImageData(imageData, 0, 0);
      canvases.push(out);
    }
    setPreviewCanvases(canvases);
    setOriginalCanvases(originals);
  }, [options.device, options.dithering, options.is2bit, rotation]);

  useEffect(() => {
    if (hasNaturalSize && slices.length > 0) {
      generatePreviews(slices);
    }
  }, [options.dithering, options.is2bit, hasNaturalSize, slices, generatePreviews]);

  const drawOverlay = useCallback(() => {
    if (!canvasRef.current || !hasNaturalSize) return;
    const img = imgRef.current;
    if (!img) return;
    const canvas = canvasRef.current;
    const container = canvas.parentElement!;
    const maxW = container.clientWidth - 40;
    const maxH = container.clientHeight - 60;

    const sourceCanvas = getRotatedImage();
    const srcW = sourceCanvas.width;
    const srcH = sourceCanvas.height;

    const scale = Math.min(maxW / srcW, maxH / srcH, 1);
    const dispW = Math.round(srcW * scale);
    const dispH = Math.round(srcH * scale);

    canvas.width = dispW;
    canvas.height = dispH;
    const cctx = canvas.getContext('2d')!;
    cctx.drawImage(sourceCanvas, 0, 0, dispW, dispH);

    if (selectedSlice >= 0 && slices.length > 0 && !skipSlicing) {
      for (let i = 0; i < slices.length; i++) {
        const s = slices[i];
        const sx = s.x * scale;
        const sy = s.y * scale;
        const sw = s.width * scale;
        const sh = s.height * scale;

        if (i === selectedSlice) {
          cctx.fillStyle = 'rgba(212, 67, 42, 0.15)';
          cctx.fillRect(sx, sy, sw, sh);
          cctx.strokeStyle = '#d4432a';
          cctx.lineWidth = 3;
          cctx.strokeRect(sx, sy, sw, sh);
        } else {
          cctx.strokeStyle = '#d4432a';
          cctx.lineWidth = 2;
          cctx.setLineDash([6, 3]);
          cctx.strokeRect(sx, sy, sw, sh);
          cctx.setLineDash([]);
        }

        cctx.fillStyle = '#d4432a';
        cctx.font = 'bold 14px sans-serif';
        cctx.fillText(`${i + 1}`, sx + 6, sy + 18);
      }
    }
  }, [naturalSize, slices, selectedSlice, rotation, skipSlicing, hasNaturalSize]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
      if (e.key === ' ' && selectedSlice >= 0) {
        e.preventDefault();
        setShowModal(v => !v);
      }
      if (e.key === 'ArrowLeft' && selectedSlice > 0) {
        setSelectedSlice(selectedSlice - 1);
      }
      if (e.key === 'ArrowRight' && selectedSlice < slices.length - 1) {
        setSelectedSlice(selectedSlice + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal, selectedSlice, slices.length]);

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <h3 className="preview-title">{imageName}</h3>
        <div className="preview-orientation">
          <button
            className={`btn btn-sm ${spoilerBlur ? 'active' : ''}`}
            onClick={() => onSpoilerBlurChange(!spoilerBlur)}
            title={spoilerBlur ? 'Disable anti-spoiler blur' : 'Enable anti-spoiler blur'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              {spoilerBlur ? (
                <><path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><line x1="1.5" y1="1.5" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></>
              ) : (
                <><path d="M1 7s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/></>
              )}
            </svg>
            Spoiler
          </button>
        </div>
      </div>

      <img ref={imgRef} src={imageUrl} alt="" style={{ display: 'none' }} />

      <div className={`preview-canvas-wrapper${spoilerBlur ? ' spoiler-blur' : ''}`}>
        <button
          className="canvas-btn-side canvas-btn-left"
          onClick={() => onSkipSlicingChange(!skipSlicing)}
          title={skipSlicing ? 'Enable slicing' : 'Skip slicing (full page only)'}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            {skipSlicing ? (
              <path d="M5 4l3 3M5 4l-3 3M5 4v12M15 16l-3-3M15 16l3-3M15 16V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            ) : (
              <path d="M4 3l4 4M4 3L2 5M4 3v12M16 17l-4-4M16 17l2-2M16 17V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            )}
          </svg>
        </button>

        <div className="preview-canvas-container" ref={containerRef}>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div className="preview-skeleton" />
              <div className="preview-loading">Loading image\u2026</div>
            </div>
          )}
        </div>

        <button
          className="canvas-btn-side canvas-btn-right"
          onClick={() => {
            const next = rotation === 0 ? 90 : rotation === 90 ? 180 : rotation === 180 ? 270 : 0;
            onRotationChange(next);
          }}
          title={`Rotated ${rotation}° — click to rotate 90° CW`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 10a6 6 0 0110.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M15 3v3.5H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {previewCanvases.length > 0 && (
        <div className={`slice-strip${skipSlicing ? ' slicing-disabled' : ''}`}>
          {previewCanvases.map((canvas, i) => {
            const sliceIndex = i - 1;
            const sl = sliceIndex >= 0 ? slices[sliceIndex] : null;
            return (
              <button
                key={i}
                className={`slice-thumb ${sliceIndex === selectedSlice ? 'selected' : ''}`}
                onClick={() => setSelectedSlice(sliceIndex)}
                onMouseEnter={() => setHoveredThumb(sliceIndex)}
                onMouseLeave={() => setHoveredThumb(-2)}
                aria-label={i === 0 ? 'Full page preview' : `Slice ${i} preview`}
              >
                <SliceCanvas canvas={canvas} />
                <span className="slice-label">{i === 0 ? 'Full' : `${i}`}</span>
                {hoveredThumb === sliceIndex && (
                  <span
                    className="slice-view-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSlice(sliceIndex);
                      setShowModal(true);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setSelectedSlice(sliceIndex); setShowModal(true); } }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <circle cx="5" cy="5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                      <line x1="5" y1="3.5" x2="5" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="3.5" y1="5" x2="6.5" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    View
                  </span>
                )}
                {hoveredThumb === sliceIndex && sl && (
                  <div className="slice-tooltip">
                    <div>Slice {sliceIndex + 1}</div>
                    <div>{sl.width}×{sl.height}px</div>
                    <div>Offset: {sl.x},{sl.y}</div>
                  </div>
                )}
                {hoveredThumb === sliceIndex && i === 0 && (
                  <div className="slice-tooltip">
                    <div>Full page preview</div>
                    <div>{naturalSize.width}×{naturalSize.height}px</div>
                    <div>Dithered at target resolution</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="slice-modal" onClick={e => e.stopPropagation()}>
            <div className="slice-modal-header">
              <span className="slice-modal-title">
                {imageName} — {selectedSlice < 0 ? 'Full page' : `Slice ${selectedSlice + 1} / ${slices.length}`}
              </span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {originalCanvases.length > 0 && (
                  <button
                    className={`btn btn-xs ${!showOriginal ? 'active' : ''}`}
                    onClick={() => setShowOriginal(v => !v)}
                    title={showOriginal ? 'Show dithered result' : 'Show original grayscale'}
                  >
                    {showOriginal ? 'Dithered' : 'Original'}
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => setShowModal(false)} aria-label="Close preview">✕</button>
              </div>
            </div>
            <div className="slice-modal-body">
              {(() => {
                const idx = selectedSlice < 0 ? 0 : selectedSlice + 1;
                const canvas = showOriginal && originalCanvases[idx] ? originalCanvases[idx] : previewCanvases[idx];
                return canvas ? <SliceCanvas canvas={canvas} /> : null;
              })()}
            </div>
            <div className="slice-modal-footer">
              <button
                className="btn btn-sm"
                disabled={selectedSlice <= 0}
                onClick={() => setSelectedSlice(selectedSlice - 1)}
                aria-label="Previous slice"
              >
                ◀
              </button>
              <span className="slice-modal-counter">
                {selectedSlice < 0 ? 'Full page' : `Slice ${selectedSlice + 1} of ${slices.length}`}
              </span>
              <button
                className="btn btn-sm"
                disabled={selectedSlice < 0 || selectedSlice >= slices.length - 1}
                onClick={() => setSelectedSlice(selectedSlice + 1)}
                aria-label="Next slice"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
