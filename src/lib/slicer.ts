import type { CropSlice, OrientationMode } from '../types';

export interface SliceResult {
  slices: CropSlice[];
  sliceWidth: number;
  sliceHeight: number;
}

/**
 * Divide una imagen en 5 slices horizontales con aspecto 5:3.
 *
 * Estrategia:
 * - La imagen se usa a su ancho completo.
 * - Cada slice tiene altura = ancho × 3/5 (aspecto 5:3).
 * - 5 slices se distribuyen uniformemente desde Y=0 hasta Y=H-sliceHeight.
 * - Si H <= sliceHeight*1.2, la imagen es muy corta → 1 slice centrado.
 * - Las slices se superponen para crear efecto de scroll orgánico.
 *
 * @param imageWidth  Ancho de la imagen fuente
 * @param imageHeight Alto de la imagen fuente
 * @param orientation Modo portrait o landscape
 * @returns           Las 5 slices calculadas
 */
export function computeSlices(
  imageWidth: number,
  imageHeight: number,
  orientation: OrientationMode
): SliceResult {
  const useAsLandscape = orientation === 'landscape';

  const w = imageWidth;
  const h = imageHeight;

  if (useAsLandscape) {
    const sliceHeight = w;
    const sliceWidth = Math.round(sliceHeight * 5 / 3);

    if (sliceWidth >= w) {
      return {
        slices: [{
          index: 0,
          x: 0,
          y: 0,
          width: w,
          height: sliceHeight,
        }],
        sliceWidth: w,
        sliceHeight,
      };
    }

    const step = (w - sliceWidth) / 4;
    const slices: CropSlice[] = [];

    for (let i = 0; i < 5; i++) {
      const x = Math.round(i * step);
      slices.push({
        index: i,
        x: Math.round(x),
        y: 0,
        width: sliceWidth,
        height: sliceHeight,
      });
    }

    return { slices, sliceWidth, sliceHeight };
  }

  // Modo portrait: slices horizontales (a lo ancho de la imagen)
  const sliceHeight = Math.round(w * 3 / 5);
  const maxValidY = h - sliceHeight;

  if (maxValidY <= 0) {
    return {
      slices: [{
        index: 0,
        x: 0,
        y: 0,
        width: w,
        height: h,
      }],
      sliceWidth: w,
      sliceHeight: h,
    };
  }

  const step = maxValidY / 4;
  const slices: CropSlice[] = [];

  for (let i = 0; i < 5; i++) {
    let y = i * step;
    if (i === 4) y = maxValidY;

    slices.push({
      index: i,
      x: 0,
      y: Math.round(y),
      width: w,
      height: sliceHeight,
    });
  }

  return { slices, sliceWidth: w, sliceHeight };
}

/**
 * Extrae un slice del canvas fuente y lo renderiza en un canvas de salida.
 * @param sourceCanvas Canvas con la imagen fuente
 * @param slice        Descripción del slice a extraer
 * @param targetWidth  Ancho de salida (800 para landscape)
 * @param targetHeight Alto de salida (480 para landscape)
 * @returns            Canvas con el slice renderizado
 */
export function extractSlice(
  sourceCanvas: HTMLCanvasElement,
  slice: CropSlice,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = targetWidth;
  out.height = targetHeight;
  const ctx = out.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  const sx = slice.x;
  const sy = slice.y;
  const sw = slice.width;
  const sh = slice.height;

  if (sw <= 0 || sh <= 0) return out;

  const scale = Math.min(targetWidth / sw, targetHeight / sh);
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  const dx = Math.round((targetWidth - dw) / 2);
  const dy = Math.round((targetHeight - dh) / 2);

  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, dx, dy, dw, dh);

  return out;
}
