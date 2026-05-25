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
 * Extrae un slice, lo rota 90° y lo renderiza en el canvas de salida.
 * La rotación 90° es necesaria para que el contenido del strip (5:3 horizontal)
 * se almacene como página vertical (3:5) en el formato XTC, que el dispositivo
 * Xteink espera en orientación portrait (480×800).
 *
 * @param sourceCanvas Canvas con la imagen fuente
 * @param slice        Descripción del slice a extraer
 * @param targetWidth  Ancho de salida (480 para X4)
 * @param targetHeight Alto de salida (800 para X4)
 * @returns            Canvas con el slice extraído, rotado y redimensionado
 */
export function extractAndRotateSlice(
  sourceCanvas: HTMLCanvasElement,
  slice: CropSlice,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const sx = slice.x;
  const sy = slice.y;
  const sw = slice.width;
  const sh = slice.height;

  if (sw <= 0 || sh <= 0) {
    const blank = document.createElement('canvas');
    blank.width = targetWidth;
    blank.height = targetHeight;
    const ctx = blank.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    return blank;
  }

  // 1. Extraer el strip
  const extracted = document.createElement('canvas');
  extracted.width = sw;
  extracted.height = sh;
  const extCtx = extracted.getContext('2d')!;
  extCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  // 1.5 Convertir a escala de grises a resolución completa (antes de rotar/redimensionar,
  //      así la interpolación bilinear opera sobre datos de un solo canal)
  const srcData = extCtx.getImageData(0, 0, sw, sh);
  const srcPixels = srcData.data;
  for (let i = 0; i < srcPixels.length; i += 4) {
    const gray = Math.round(srcPixels[i] * 0.299 + srcPixels[i + 1] * 0.587 + srcPixels[i + 2] * 0.114);
    srcPixels[i] = srcPixels[i + 1] = srcPixels[i + 2] = gray;
  }
  extCtx.putImageData(srcData, 0, 0);

  // 2. Rotar 90° clockwise (strip horizontal → vertical para XTC)
  const rotated = document.createElement('canvas');
  rotated.width = sh;
  rotated.height = sw;
  const rotCtx = rotated.getContext('2d')!;
  rotCtx.translate(rotated.width / 2, rotated.height / 2);
  rotCtx.rotate(90 * Math.PI / 180);
  rotCtx.drawImage(extracted, -extracted.width / 2, -extracted.height / 2);

  // 3. Redimensionar con letterbox al tamaño target
  const out = document.createElement('canvas');
  out.width = targetWidth;
  out.height = targetHeight;
  const outCtx = out.getContext('2d')!;
  outCtx.fillStyle = '#FFFFFF';
  outCtx.fillRect(0, 0, targetWidth, targetHeight);

  const scale = Math.min(targetWidth / rotated.width, targetHeight / rotated.height);
  const dw = Math.round(rotated.width * scale);
  const dh = Math.round(rotated.height * scale);
  const dx = Math.round((targetWidth - dw) / 2);
  const dy = Math.round((targetHeight - dh) / 2);
  outCtx.drawImage(rotated, 0, 0, rotated.width, rotated.height, dx, dy, dw, dh);

  return out;
}
