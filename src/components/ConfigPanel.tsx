import { memo } from 'react';
import type { DitherAlgorithm, Device } from '../types';

interface ConfigPanelProps {
  device: Device;
  dithering: DitherAlgorithm;
  is2bit: boolean;
  contrast: number;
  mergeMode: 'single' | 'separate';
  onDeviceChange: (d: Device) => void;
  onDitheringChange: (d: DitherAlgorithm) => void;
  onIs2bitChange: (v: boolean) => void;
  onContrastChange: (v: number) => void;
  onMergeModeChange: (v: 'single' | 'separate') => void;
  onFilesSelected: (files: FileList) => void;
  onCbzSelected: (files: File[]) => void;
  disabled: boolean;
}

const DITHER_OPTIONS: { value: DitherAlgorithm; label: string }[] = [
  { value: 'none', label: 'None (Threshold)' },
  { value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'sierra-lite', label: 'Sierra Lite' },
  { value: 'ordered', label: 'Ordered (Bayer)' },
];

export const ConfigPanel = memo(function ConfigPanel({
  device, dithering, is2bit, contrast, mergeMode,
  onDeviceChange, onDitheringChange, onIs2bitChange, onContrastChange, onMergeModeChange,
  onFilesSelected, onCbzSelected, disabled,
}: ConfigPanelProps) {

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const cbzFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.cbz'));
    if (cbzFiles.length > 0) {
      onCbzSelected(cbzFiles);
    } else {
      onFilesSelected(files);
    }
    e.target.value = '';
  };

  return (
    <div className="config-panel">
      <div className="config-row">
        <label className="config-label-file" htmlFor="file-input">Images:</label>
        <div className="config-file-wrap">
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/*,.cbz"
            onChange={handleFileChange}
            disabled={disabled}
            className="config-file-input"
          />
          <span className="config-file-btn">Choose files</span>
        </div>
      </div>

      <div className="config-row">
        <label>Device:</label>
        <div className="config-btn-group">
          <button className={device === 'X4' ? 'active' : ''} onClick={() => onDeviceChange('X4')} disabled={disabled}>
            X4 (480×800)
          </button>
          <button className={device === 'X3' ? 'active' : ''} onClick={() => onDeviceChange('X3')} disabled={disabled}>
            X3 (528×792)
          </button>
        </div>
      </div>

      <div className="config-row">
        <label>Color:</label>
        <div className="config-btn-group">
          <button className={!is2bit ? 'active' : ''} onClick={() => onIs2bitChange(false)} disabled={disabled}>
            1-bit (XTC)
          </button>
          <button className={is2bit ? 'active' : ''} onClick={() => onIs2bitChange(true)} disabled={disabled}>
            2-bit (XTCH)
          </button>
        </div>
      </div>

      <div className="config-row">
        <label htmlFor="dither-select">Dither:</label>
        <select
          id="dither-select"
          value={dithering}
          onChange={(e) => onDitheringChange(e.target.value as DitherAlgorithm)}
          disabled={disabled}
        >
          {DITHER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="config-row">
        <label>Contrast: {contrast}</label>
        <input
          type="range" min="0" max="8" step="1"
          value={contrast}
          onChange={(e) => onContrastChange(parseInt(e.target.value))}
          disabled={disabled}
        />
      </div>

      <div className="config-row">
        <label>Output:</label>
        <div className="config-btn-group">
          <button className={mergeMode === 'single' ? 'active' : ''} onClick={() => onMergeModeChange('single')} disabled={disabled}>
            Single file
          </button>
          <button className={mergeMode === 'separate' ? 'active' : ''} onClick={() => onMergeModeChange('separate')} disabled={disabled}>
            Separate files
          </button>
        </div>
      </div>
    </div>
  );
});
