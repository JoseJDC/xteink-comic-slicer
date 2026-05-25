import type { DitherAlgorithm } from '../../types';

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function threshold1bit(value: number): number {
  return value < 128 ? 0 : 255;
}

function quantize2bit(value: number): number {
  if (value >= 212) return 0;
  if (value >= 127) return 1;
  if (value >= 42) return 2;
  return 3;
}

export function applyDither(
  imageData: ImageData,
  algorithm: DitherAlgorithm,
  is2bit: boolean
): ImageData {
  const { width, height, data } = imageData;
  const pixels = new Uint8ClampedArray(data);

  if (algorithm === 'none') {
    for (let i = 0; i < pixels.length; i += 4) {
      const gray = pixels[i];
      if (is2bit) {
        const q = quantize2bit(gray);
        pixels[i] = pixels[i + 1] = pixels[i + 2] = q === 0 ? 255 : q === 3 ? 0 : q === 1 ? 170 : 85;
      } else {
        const v = threshold1bit(gray);
        pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
      }
    }
    return new ImageData(pixels, width, height);
  }

  const grayscale = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    grayscale[i] = pixels[i * 4];
  }

  function setPixel(x: number, y: number, value: number) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grayscale[y * width + x] = value;
    }
  }

  function getPixel(x: number, y: number): number {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      return grayscale[y * width + x];
    }
    return 128;
  }

  const quantize = is2bit ? quantize2bit : threshold1bit;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldPixel = grayscale[idx];
      const newPixel = quantize(oldPixel);
      const error = oldPixel - newPixel;

      grayscale[idx] = newPixel;

      if (Math.abs(error) < 1) continue;

      switch (algorithm) {
        case 'floyd-steinberg':
          setPixel(x + 1, y, getPixel(x + 1, y) + (error * 7) / 16);
          setPixel(x - 1, y + 1, getPixel(x - 1, y + 1) + (error * 3) / 16);
          setPixel(x, y + 1, getPixel(x, y + 1) + (error * 5) / 16);
          setPixel(x + 1, y + 1, getPixel(x + 1, y + 1) + (error * 1) / 16);
          break;
        case 'atkinson':
          setPixel(x + 1, y, getPixel(x + 1, y) + error / 8);
          setPixel(x + 2, y, getPixel(x + 2, y) + error / 8);
          setPixel(x - 1, y + 1, getPixel(x - 1, y + 1) + error / 8);
          setPixel(x, y + 1, getPixel(x, y + 1) + error / 8);
          setPixel(x + 1, y + 1, getPixel(x + 1, y + 1) + error / 8);
          setPixel(x, y + 2, getPixel(x, y + 2) + error / 8);
          break;
        case 'sierra-lite':
          setPixel(x + 1, y, getPixel(x + 1, y) + (error * 2) / 4);
          setPixel(x - 1, y + 1, getPixel(x - 1, y + 1) + error / 4);
          setPixel(x, y + 1, getPixel(x, y + 1) + error / 4);
          break;
        case 'ordered': {
          const bayer4x4 = [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5],
          ];
          const threshold = (bayer4x4[y % 4][x % 4] / 16) * 255;
          grayscale[idx] = oldPixel < threshold ? 0 : 255;
          break;
        }
      }
    }
  }

  for (let i = 0; i < width * height; i++) {
    const v = clamp(grayscale[i]);
    pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = v;
    pixels[i * 4 + 3] = 255;
  }

  return new ImageData(pixels, width, height);
}
