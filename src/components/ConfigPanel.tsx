import { memo, useState, useEffect } from 'react';
import type { DitherAlgorithm, Device } from '../types';

interface Preset {
  name: string;
  device: Device;
  dithering: DitherAlgorithm;
  is2bit: boolean;
  contrast: number;
}

const PRESETS_KEY = 'comic-slicer-presets';

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
  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      const stored = localStorage.getItem(PRESETS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);

  useEffect(() => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  }, [presets]);

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    setPresets(prev => [...prev.filter(p => p.name !== name), { name, device, dithering, is2bit, contrast }]);
    setPresetName('');
    setShowPresetInput(false);
  };

  const handleLoadPreset = (preset: Preset) => {
    onDeviceChange(preset.device);
    onDitheringChange(preset.dithering);
    onIs2bitChange(preset.is2bit);
    onContrastChange(preset.contrast);
  };

  const handleDeletePreset = (name: string) => {
    setPresets(prev => prev.filter(p => p.name !== name));
  };

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
        <div className="config-file-wrap" title="Select comic pages (JPG/PNG) or CBZ archives">
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/*,.cbz"
            onChange={handleFileChange}
            disabled={disabled}
            className="config-file-input"
          />
          <span className="config-file-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 10V3M4 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 9v2a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Choose files
          </span>
        </div>
      </div>

      <div className="config-row">
        <label>Device:</label>
        <div className="config-btn-group">
          <button className={device === 'X4' ? 'active' : ''} onClick={() => onDeviceChange('X4')} disabled={disabled} title="Xteink X4 — 480×800 px">
            X4 (480×800)
          </button>
          <button className={device === 'X3' ? 'active' : ''} onClick={() => onDeviceChange('X3')} disabled={disabled} title="Xteink X3 — 528×792 px">
            X3 (528×792)
          </button>
        </div>
      </div>

      <div className="config-row">
        <label>Color:</label>
        <div className="config-btn-group">
          <button className={!is2bit ? 'active' : ''} onClick={() => onIs2bitChange(false)} disabled={disabled} title="1-bit black and white (smaller files)">
            1-bit (XTC)
          </button>
          <button className={is2bit ? 'active' : ''} onClick={() => onIs2bitChange(true)} disabled={disabled} title="2-bit grayscale with 4 levels (better quality)">
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
          title="Dithering algorithm for black-and-white conversion"
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
          title="Increase contrast to darken blacks and brighten whites (0 = off)"
        />
      </div>

      <div className="config-row">
        <label>Output:</label>
        <div className="config-btn-group">
          <button className={mergeMode === 'single' ? 'active' : ''} onClick={() => onMergeModeChange('single')} disabled={disabled} title="Merge all images into one .xtc file">
            Single file
          </button>
          <button className={mergeMode === 'separate' ? 'active' : ''} onClick={() => onMergeModeChange('separate')} disabled={disabled} title="Generate one .xtc file per source image">
            Separate files
          </button>
        </div>
      </div>

      <div className="config-divider" />

      <div className="config-row">
        <label>Presets:</label>
        <div className="config-presets">
          {presets.length === 0 && !showPresetInput && (
            <button className="config-preset-add" onClick={() => setShowPresetInput(true)} aria-label="Add new preset">
              + Save preset
            </button>
          )}
          {presets.map(p => (
            <div key={p.name} className="config-preset-item">
              <button className="config-preset-btn" onClick={() => handleLoadPreset(p)} title={`Load: ${p.name}`}>
                {p.name}
              </button>
              <button className="config-preset-del" onClick={() => handleDeletePreset(p.name)} aria-label={`Delete preset "${p.name}"`}>✕</button>
            </div>
          ))}
          {presets.length > 0 && !showPresetInput && (
            <button className="config-preset-add" onClick={() => setShowPresetInput(true)} aria-label="Add new preset">+</button>
          )}
          {showPresetInput && (
            <div className="config-preset-input-row">
              <input
                className="config-preset-input"
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setShowPresetInput(false); }}
                placeholder="Preset name\u2026"
                autoFocus
              />
              <button className="btn btn-xs" onClick={handleSavePreset} disabled={!presetName.trim()}>Save</button>
              <button className="btn btn-xs" onClick={() => setShowPresetInput(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
