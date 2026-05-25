import { useState, useCallback } from 'react';
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
  const [dithering, setDithering] = useState<DitherAlgorithm>('none');
  const [is2bit, setIs2bit] = useState(true);
  const [contrast, setContrast] = useState(0);

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
            onDeviceChange={setDevice}
            onDitheringChange={setDithering}
            onIs2bitChange={setIs2bit}
            onContrastChange={setContrast}
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
            />
          )}
        </aside>

        <section className="app-content">
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
              <div className="empty-icon">🎨</div>
              <h2>No images loaded</h2>
              <p>Select comic pages above to get started</p>
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
