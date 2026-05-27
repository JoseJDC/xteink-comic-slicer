import { useState, useCallback, useEffect, useRef } from 'react';
import type { ConversionOptions, OrientationMode, DitherAlgorithm } from './types';
import { useImages } from './hooks/useImages';
import { ConfigPanel } from './components/ConfigPanel';
import { ImageList } from './components/ImageList';
import { PreviewPanel } from './components/PreviewPanel';
import { BatchPanel } from './components/BatchPanel';
import { loadCbzAsImages } from './lib/cbz';
import './App.css';

export default function App() {
  const images = useImages();
  const [device, setDevice] = useState<ConversionOptions['device']>('X4');
  const [dithering, setDithering] = useState<DitherAlgorithm>('floyd-steinberg');
  const [is2bit, setIs2bit] = useState(false);
  const [contrast, setContrast] = useState(0);
  const [mergeMode, setMergeMode] = useState<'single' | 'separate'>('single');

  const options: ConversionOptions = { device, dithering, is2bit, contrast };

  const handleFilesSelected = useCallback((files: FileList) => {
    images.loadFromFiles(files);
  }, [images]);

  const handleCbzSelected = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        const entries = await loadCbzAsImages(file);
        const sourceName = file.name.replace(/\.cbz$/i, '');
        images.loadCbzFiles(entries.map((e) => ({ name: e.name, blob: e.data })), sourceName);
      } catch (err) {
        console.error('CBZ load error:', file.name, err);
      }
    }
  }, [images]);

  const handleOrientationChange = useCallback((index: number, orientation: OrientationMode) => {
    images.setOrientation(index, orientation);
  }, [images]);

  const disabled = false;
  const [isDragging, setIsDragging] = useState(false);
  const dragCount = useRef(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCount.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCount.current--;
    if (dragCount.current <= 0) {
      dragCount.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCount.current = 0;
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const cbzFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.cbz'));
    if (cbzFiles.length > 0) {
      handleCbzSelected(cbzFiles);
    } else {
      handleFilesSelected(files);
    }
  }, [handleFilesSelected, handleCbzSelected]);

  useEffect(() => {
    if (images.images.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft' && images.currentIndex > 0) {
        images.selectImage(images.currentIndex - 1);
      }
      if (e.key === 'ArrowRight' && images.currentIndex < images.images.length - 1) {
        images.selectImage(images.currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Comic Slicer</h1>
        <p className="app-subtitle">Convert comics to XTC format for Xteink e-readers</p>
      </header>

      <main className="app-main">
        <aside className="app-sidebar">
          <ConfigPanel
            device={device}
            dithering={dithering}
            is2bit={is2bit}
            contrast={contrast}
            mergeMode={mergeMode}
            onDeviceChange={setDevice}
            onDitheringChange={setDithering}
            onIs2bitChange={setIs2bit}
            onContrastChange={setContrast}
            onMergeModeChange={setMergeMode}
            onFilesSelected={handleFilesSelected}
            onCbzSelected={handleCbzSelected}
            disabled={disabled}
          />

          {images.error && <div className="error-banner">{images.error}</div>}

          {images.images.length > 0 && (
            <ImageList
              images={images.images}
              currentIndex={images.currentIndex}
              onSelect={images.selectImage}
            />
          )}

          {images.images.length > 0 && (
            <BatchPanel
              images={images.images}
              options={options}
              mergeMode={mergeMode}
            />
          )}
        </aside>

        <section
          className="app-content"
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="drop-overlay">
              <div className="drop-overlay-content">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 6v36M6 24h36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Drop files here</span>
              </div>
            </div>
          )}
          {images.currentImage ? (
            <PreviewPanel
              key={images.currentIndex}
              imageUrl={images.currentImage.url}
              imageName={images.currentImage.name}
              orientation={images.currentImage.orientation}
              onOrientationChange={(o) => images.setOrientation(images.currentIndex, o)}
              options={options}
            />
          ) : (
            <div className="app-empty">
              <div className="empty-icon">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="8" width="64" height="64" rx="6" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3"/>
                  <rect x="16" y="16" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.2"/>
                  <rect x="44" y="16" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.2"/>
                  <rect x="16" y="38" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.2"/>
                  <rect x="40" y="38" width="24" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.2"/>
                  <line x1="8" y1="36" x2="72" y2="36" stroke="currentColor" strokeWidth="0.5" opacity="0.15"/>
                  <line x1="38" y1="10" x2="38" y2="70" stroke="currentColor" strokeWidth="0.5" opacity="0.15"/>
                </svg>
              </div>
              <h2 className="empty-title">No images loaded</h2>
              <p className="empty-text">Drop comic pages here or choose files above</p>
              <p className="empty-hint">
                Each image is automatically sliced into 5 overlapping strips at 5:3 aspect ratio
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
