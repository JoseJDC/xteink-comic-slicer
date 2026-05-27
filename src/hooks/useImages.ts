import { useState, useCallback, useRef, useEffect } from 'react';
import type { ImageFile, OrientationMode } from '../types';

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
]);

interface UseImagesReturn {
  images: ImageFile[];
  currentIndex: number;
  currentImage: ImageFile | null;
  loading: boolean;
  error: string | null;
  loadFromFiles: (files: FileList | File[]) => void;
  loadCbzFiles: (files: { name: string; blob: Blob }[], source?: string) => void;
  selectImage: (index: number) => void;
  goToNext: () => void;
  goToPrev: () => void;
  setOrientation: (index: number, orientation: OrientationMode) => void;
  setSkipSlicing: (index: number, skip: boolean) => void;
  setRotation: (index: number, rotation: 0 | 90 | 180 | 270) => void;
  clear: () => void;
}

export function useImages(): UseImagesReturn {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const oldUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      oldUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const currentImage = images.length > 0 ? images[currentIndex] : null;

  const addUrls = useCallback((list: ImageFile[]) => {
    const urls = list.map((f) => f.url);
    oldUrlsRef.current.push(...urls);
    return list;
  }, []);

  const loadFromFiles = useCallback((files: FileList | File[]) => {
    setLoading(true);
    setError(null);

    const valid = Array.from(files).filter(
      (f) => IMAGE_TYPES.has(f.type) || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f.name)
    );

    if (valid.length === 0) {
      setError('No valid image files found. Supported: JPEG, PNG, GIF, WebP, BMP');
      setLoading(false);
      return;
    }

    const list = addUrls(
      valid.map((f) => ({
        name: f.name,
        url: URL.createObjectURL(f),
        processed: false,
        orientation: 'portrait' as OrientationMode,
        skipSlicing: false,
        rotation: 0 as const,
      }))
    );

    setImages((prev) => [...prev, ...list]);
    setLoading(false);
  }, [addUrls]);

  const loadCbzFiles = useCallback((entries: { name: string; blob: Blob }[], source?: string) => {
    setLoading(true);
    setError(null);

    const list = addUrls(
      entries.map((e) => ({
        name: e.name,
        url: URL.createObjectURL(e.blob),
        processed: false,
        orientation: 'portrait' as OrientationMode,
        skipSlicing: false,
        rotation: 0 as const,
        source,
      }))
    );

    setImages((prev) => [...prev, ...list]);
    setLoading(false);
  }, [addUrls]);

  const selectImage = useCallback((index: number) => {
    if (index >= 0 && index < images.length) setCurrentIndex(index);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, images.length - 1));
  }, [images.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const setOrientation = useCallback((index: number, orientation: OrientationMode) => {
    setImages((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], orientation };
      return next;
    });
  }, []);

  const setSkipSlicing = useCallback((index: number, skip: boolean) => {
    setImages((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], skipSlicing: skip };
      return next;
    });
  }, []);

  const setRotation = useCallback((index: number, rotation: 0 | 90 | 180 | 270) => {
    setImages((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], rotation };
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    oldUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    oldUrlsRef.current = [];
    setImages([]);
    setCurrentIndex(0);
    setError(null);
  }, []);

  return {
    images, currentIndex, currentImage, loading, error,
    loadFromFiles, loadCbzFiles,
    selectImage, goToNext, goToPrev, setOrientation, setSkipSlicing, setRotation, clear,
  };
}
