import type { Device } from '../../types';

const DEVICE_DIMENSIONS: Record<Device, { width: number; height: number }> = {
  X4: { width: 800, height: 480 },
  X3: { width: 792, height: 528 },
};

export function getTargetDimensions(device: Device): { width: number; height: number } {
  return DEVICE_DIMENSIONS[device];
}

export function resizeWithPadding(
  canvas: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  bgColor: string = '#FFFFFF'
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, targetW, targetH);

  const scale = Math.min(targetW / canvas.width, targetH / canvas.height);
  const w = Math.round(canvas.width * scale);
  const h = Math.round(canvas.height * scale);
  const x = Math.round((targetW - w) / 2);
  const y = Math.round((targetH - h) / 2);

  ctx.drawImage(canvas, x, y, w, h);
  return out;
}

export function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = Math.round(canvas.width * cos + canvas.height * sin);
  const h = Math.round(canvas.width * sin + canvas.height * cos);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}
