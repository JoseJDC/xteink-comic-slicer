import { useRef, useEffect, useState, memo } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import type { ImageFile } from '../types';

interface ImageListProps {
  images: ImageFile[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

interface RowData {
  images: ImageFile[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

const ROW_HEIGHT = 46;

export const ImageList = memo(function ImageList({ images, currentIndex, onSelect }: ImageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(Math.floor(entry.contentRect.height));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (images.length === 0) return null;

  return (
    <div className="image-list">
      <div className="image-list-header">
        <span>{images.length} images</span>
      </div>
      <div className="image-list-scroll" ref={scrollRef}>
        {height > 0 && (
          <FixedSizeList
            height={height}
            itemCount={images.length}
            itemSize={ROW_HEIGHT}
            width="100%"
            overscanCount={5}
            itemData={{ images, currentIndex, onSelect } as RowData}
            children={Row}
          />
        )}
      </div>
    </div>
  );
});

const Row = memo(function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const { images, currentIndex, onSelect } = data;
  const img = images[index];
  return (
    <div
      style={style}
      className={`image-list-item ${index === currentIndex ? 'selected' : ''} ${img.processed ? 'processed' : ''}`}
      onClick={() => onSelect(index)}
    >
      <div className="image-list-thumb">
        <img src={img.url} alt={img.name} loading="lazy" />
      </div>
      <div className="image-list-info">
        <span className="image-list-name" title={img.name}>{img.name}</span>
        <span className={`image-list-orientation ${img.orientation}`}>
          {img.orientation === 'portrait' ? '↕ Portrait' : '↔ Landscape'}
        </span>
      </div>
    </div>
  );
});
