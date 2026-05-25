import type { ConversionOptions, ConversionProgress, CropSlice, OrientationMode } from '../types';
import { computeSlices, extractSlice } from './slicer';
import { imageDataToXtg, imageDataToXth } from './processing/xtg';
import { applyDither } from './processing/dithering';
import { getTargetDimensions } from './processing/canvas';
import { buildXtc } from './xtc-format';

interface PageEntry {
  data: ArrayBuffer;
  width: number;
  height: number;
}

function toGrayscale(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < width * height; i++) {
    const off = i * 4;
    const gray = Math.round(
      data[off] * 0.299 + data[off + 1] * 0.587 + data[off + 2] * 0.114
    );
    out[off] = out[off + 1] = out[off + 2] = gray;
    out[off + 3] = 255;
  }
  return new ImageData(out, width, height);
}

function applyContrast(imageData: ImageData, level: number): ImageData {
  if (level === 0) return imageData;
  const { data, width, height } = imageData;
  const pixels = new Uint8ClampedArray(data);

  let min = 255;
  let max = 0;
  for (let i = 0; i < width * height; i++) {
    const v = pixels[i * 4];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  if (range < 5) return imageData;

  const factor = 1 + level * 0.15;
  const mid = (min + max) / 2;
  const halfRange = (range / 2) * factor;

  const newMin = Math.max(0, Math.round(mid - halfRange));
  const newMax = Math.min(255, Math.round(mid + halfRange));
  const newRange = newMax - newMin;

  if (newRange < 1) return imageData;

  for (let i = 0; i < width * height; i++) {
    const off = i * 4;
    const v = pixels[off];
    const stretched = ((v - newMin) / newRange) * 255;
    const clamped = Math.max(0, Math.min(255, Math.round(stretched)));
    pixels[off] = pixels[off + 1] = pixels[off + 2] = clamped;
  }

  return new ImageData(pixels, width, height);
}

async function processSlice(
  sourceCanvas: HTMLCanvasElement,
  slice: CropSlice,
  options: ConversionOptions,
  targetW: number,
  targetH: number
): Promise<ArrayBuffer> {
  const sliceCanvas = extractSlice(sourceCanvas, slice, targetW, targetH);
  const ctx = sliceCanvas.getContext('2d')!;
  let imageData = ctx.getImageData(0, 0, targetW, targetH);

  imageData = toGrayscale(imageData);
  imageData = applyContrast(imageData, options.contrast);
  imageData = applyDither(imageData, options.dithering, options.is2bit);

  if (options.is2bit) {
    return imageDataToXth(imageData);
  }
  return imageDataToXtg(imageData);
}

export interface ConversionResult {
  blob: Blob;
  filename: string;
  pageCount: number;
}

export async function convertImages(
  images: Array<{ canvas: HTMLCanvasElement; name: string; orientation: OrientationMode }>,
  options: ConversionOptions,
  onProgress: (p: ConversionProgress) => void,
  signal?: AbortSignal
): Promise<ConversionResult> {
  const pages: PageEntry[] = [];
  const { width: targetW, height: targetH } = getTargetDimensions(options.device);

  let totalSlices = 0;
  const sliceCounts: number[] = [];

  for (const img of images) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const imgWidth = img.canvas.width;
    const imgHeight = img.canvas.height;
    const { slices } = computeSlices(imgWidth, imgHeight, img.orientation);
    sliceCounts.push(slices.length);
    totalSlices += slices.length;
  }

  let processed = 0;

  for (let i = 0; i < images.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const img = images[i];
    const { slices } = computeSlices(img.canvas.width, img.canvas.height, img.orientation);

    for (const slice of slices) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      onProgress({
        current: processed,
        total: totalSlices,
        message: `${img.name}: slice ${slice.index + 1}/${slices.length}`,
      });

      const data = await processSlice(img.canvas, slice, options, targetW, targetH);
      pages.push({
        data,
        width: targetW,
        height: targetH,
      });
      processed++;
    }
  }

  onProgress({
    current: totalSlices,
    total: totalSlices,
    message: 'Assembling XTC file...',
  });

  const xtcBuffer = buildXtc(pages, options.is2bit);
  const blob = new Blob([xtcBuffer]);

  const title = images.length === 1
    ? images[0].name.replace(/\.[^.]+$/, '')
    : 'comic';

  const ext = options.is2bit ? 'xtch' : 'xtc';
  const filename = `${title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)}.${ext}`;

  onProgress({
    current: totalSlices,
    total: totalSlices,
    message: 'Done!',
  });

  return { blob, filename, pageCount: pages.length };
}
