import type { ImageFile } from '../types';

interface ImageListProps {
  images: ImageFile[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function ImageList({ images, currentIndex, onSelect }: ImageListProps) {
  if (images.length === 0) return null;

  return (
    <div className="image-list">
      <div className="image-list-header">
        <span>{images.length} images</span>
      </div>
      <div className="image-list-scroll">
        {images.map((img, i) => (
          <div
            key={i}
            className={`image-list-item ${i === currentIndex ? 'selected' : ''} ${img.processed ? 'processed' : ''}`}
            onClick={() => onSelect(i)}
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
        ))}
      </div>
    </div>
  );
}
