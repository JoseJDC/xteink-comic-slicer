import type { ConversionOptions, ConversionProgress, CropSlice, OrientationMode } from '../types';
import { computeSlices, extractAndRotateSlice, extractFullPage } from './slicer';
import { imageDataToXtg, imageDataToXth } from './processing/xtg';
import { applyDither } from './processing/dithering';
import { getTargetDimensions } from './processing/canvas';
import { buildXtc } from './xtc-format';

interface PageEntry {
  data: ArrayBuffer;
  width: number;
  height: number;
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
  const sliceCanvas = extractAndRotateSlice(sourceCanvas, slice, targetW, targetH);
  const ctx = sliceCanvas.getContext('2d')!;
  let imageData = ctx.getImageData(0, 0, targetW, targetH);

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

async function processFullPage(
  sourceCanvas: HTMLCanvasElement,
  options: ConversionOptions,
  targetW: number,
  targetH: number
): Promise<ArrayBuffer> {
  const pageCanvas = extractFullPage(sourceCanvas, targetW, targetH);
  const ctx = pageCanvas.getContext('2d')!;
  let imageData = ctx.getImageData(0, 0, targetW, targetH);

  imageData = applyContrast(imageData, options.contrast);
  imageData = applyDither(imageData, options.dithering, options.is2bit);

  if (options.is2bit) {
    return imageDataToXth(imageData);
  }
  return imageDataToXtg(imageData);
}

export async function convertImages(
  images: Array<{ canvas: HTMLCanvasElement; name: string; orientation: OrientationMode }>,
  options: ConversionOptions,
  onProgress: (p: ConversionProgress) => void,
  signal?: AbortSignal,
  title?: string
): Promise<ConversionResult> {
  const pages: PageEntry[] = [];
  const { width: targetW, height: targetH } = getTargetDimensions(options.device);

  let totalPages = 0;
  const pagesPerImage: number[] = [];

  for (const img of images) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const { slices } = computeSlices(img.canvas.width, img.canvas.height, img.orientation);
    const count = 1 + slices.length; // 1 full page + N slices
    pagesPerImage.push(count);
    totalPages += count;
  }

  let processed = 0;

  for (let i = 0; i < images.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const img = images[i];
    const { slices } = computeSlices(img.canvas.width, img.canvas.height, img.orientation);

    // 1. Página completa primero
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    onProgress({
      current: processed,
      total: totalPages,
      message: `${img.name}: full page`,
    });

    const fullData = await processFullPage(img.canvas, options, targetW, targetH);
    pages.push({
      data: fullData,
      width: targetW,
      height: targetH,
    });
    processed++;

    // 2. Los 5 slices
    for (const slice of slices) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      onProgress({
        current: processed,
        total: totalPages,
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
    current: totalPages,
    total: totalPages,
    message: 'Assembling XTC file...',
  });

  const xtcBuffer = buildXtc(pages, options.is2bit);
  const blob = new Blob([xtcBuffer]);

  const baseTitle = title || (images.length === 1
    ? images[0].name.replace(/\.[^.]+$/, '')
    : 'comic');

  const ext = options.is2bit ? 'xtch' : 'xtc';
  const filename = `${baseTitle}.${ext}`;

  onProgress({
    current: totalPages,
    total: totalPages,
    message: 'Done!',
  });

  return { blob, filename, pageCount: pages.length };
}
