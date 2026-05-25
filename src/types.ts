export type DitherAlgorithm = 'none' | 'floyd-steinberg' | 'atkinson' | 'sierra-lite' | 'ordered';
export type Device = 'X4' | 'X3';
export type OrientationMode = 'portrait' | 'landscape';

export interface ImageFile {
  name: string;
  url: string;
  processed: boolean;
  orientation: OrientationMode;
}

export interface CropSlice {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  previewUrl?: string;
}

export interface ConversionOptions {
  device: Device;
  dithering: DitherAlgorithm;
  contrast: number;
  is2bit: boolean;
}

export interface BatchItem {
  id: string;
  imageUrl: string;
  imageName: string;
  slices: CropSlice[];
  orientation: OrientationMode;
}

export interface ConversionProgress {
  current: number;
  total: number;
  message: string;
}
