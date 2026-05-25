# Comic Slicer — Project Context

## What it is

Web app (React 19 + TypeScript + Vite 6) that converts comic pages (JPG/PNG/CBZ) to XTC format for Xteink X4/X3 e-readers. Each source image is automatically divided into **5 overlapping horizontal strips at 5:3 aspect ratio** to create a smooth "auto-scroll" effect when page-turning on the e-ink display.

## Key design decisions

- **Full client-side**: No server. Images are loaded via `<input type="file">` + `URL.createObjectURL()`. CBZ files are extracted in-browser via JSZip.
- **5-slice algorithm**: `src/lib/slicer.ts:computeSlices()` — each source image is divided into 5 strips. For portrait images: `sliceHeight = width * 3/5`, 5 strips distributed from Y=0 to Y=(H-sliceHeight) with equal step, creating intentional overlap for smooth scrolling.
- **Per-image orientation toggle**: Each image can be individually toggled portrait/landscape (for panorama spreads). ConfigPanel sets the device default, ImageList/BatchPanel allows per-item override.
- **Output**: Single `.xtc` (1-bit) or `.xtch` (2-bit grayscale) file containing all slices as sequential pages.

## File structure

```
comic-slicer/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── .opencode/project-context.md      ← this file
├── src/
│   ├── main.tsx                      ← React entry point
│   ├── App.tsx                       ← Root component, state management
│   ├── App.css                       ← All styles (~560 lines, dark theme)
│   ├── vite-env.d.ts
│   ├── types.ts                      ← DitherAlgorithm, CropSlice, ConversionOptions, etc.
│   ├── components/
│   │   ├── ConfigPanel.tsx           ← File picker + device/dither/contrast controls
│   │   ├── ImageList.tsx             ← Sidebar thumbnail list
│   │   ├── PreviewPanel.tsx          ← Main preview with 5-slice overlay + slice strip
│   │   └── BatchPanel.tsx            ← Batch queue + Convert to XTC button
│   ├── hooks/
│   │   └── useImages.ts              ← Image state via File API / blob: URLs
│   └── lib/
│       ├── slicer.ts                 ← computeSlices(), extractSlice() — THE ALGORITHM
│       ├── converter.ts              ← Orchestrator: load → slice → process → XTC
│       ├── cbz.ts                    ← CBZ extraction via JSZip
│       ├── xtc-format.ts             ← XTC binary packer (header + index + pages)
│       └── processing/
│           ├── dithering.ts          ← 5 algorithms: Floyd, Atkinson, Sierra, Bayer, None
│           ├── xtg.ts                ← XTG (1-bit) / XTH (2-bit) page encoder
│           └── canvas.ts             ← resizeWithPadding(), rotateCanvas()
```

## The 5-slice algorithm (`slicer.ts:computeSlices`)

For a portrait image (W × H):

```
sliceHeight = W * 3/5     (aspecto 5:3)
step = (H - sliceHeight) / 4

Slice 0: crop(0, 0,          W, sliceHeight)
Slice 1: crop(0, step*1,     W, sliceHeight)
Slice 2: crop(0, step*2,     W, sliceHeight)
Slice 3: crop(0, step*3,     W, sliceHeight)
Slice 4: crop(0, H - sliceHeight, W, sliceHeight)   ← aligned to bottom edge
```

If `H <= sliceHeight * 1.2`: image is too short → emit 1 centered slice.
For landscape images (`orientation === 'landscape'`): same logic but vertical slices (along X axis), rotated after extraction.

`extractSlice()` renders the crop to a target canvas (final device dimensions) with white padding, using `drawImage` with `Math.max(scaleX, scaleY)` to fill the frame.

## Conversion pipeline (`converter.ts:convertImages`)

1. For each image, call `computeSlices()` to get CropSlice[]
2. For each slice, call `extractSlice()` to render to device-sized canvas (480×800 or 528×792)
3. Grayscale conversion (luminosity: 0.299R + 0.587G + 0.114B)
4. Optional contrast stretch (0-8, factor 1 + level * 0.15)
5. Dithering via `applyDither()` (in-place on ImageData)
6. XTG/XTH binary encoding via `imageDataToXtg()` / `imageDataToXth()`
7. XTC assembly via `buildXtc()` — merges all page blobs with header + index table

## XTC binary format (`xtc-format.ts`)

```
[56-byte header] → magic (XTC\0 or XTCH), version, pageCount, offsets
[16 bytes × N pages] → page table (offset, size, width, height)
[N × XTG pages] → [22-byte XTG header] + [pixel data row-major MSB]
```

- `setUint64LE()` custom helper (no native DataView.setUint64)
- `buildXtc(pages, is2bit)` — returns single ArrayBuffer ready to Blob+download

## XTG/XTH page encoding (`processing/xtg.ts`)

**XTG (1-bit)**: Row-major, `rowBytes = ceil(width/8)`, MSB first. Bit=0=black, Bit=1=white. Threshold at 128.

**XTH (2-bit)**: Column-major, two bit planes. 4 levels: 0=white(≥212), 1=light gray(≥127), 2=dark gray(≥42), 3=black(<42).

## Dithering (`processing/dithering.ts`)

| Algorithm | Method | Notes |
|-----------|--------|-------|
| `none` | Threshold at 128 | Simple binarization |
| `floyd-steinberg` | Error diffusion, kernel [7,3,5,1]/16 | Best all-rounder |
| `atkinson` | Error diffusion, kernel [1,1,1,1,1,1]/8 | Lighter, retains details |
| `sierra-lite` | Error diffusion, kernel [2,1,1]/4 | Fast, decent quality |
| `ordered` | Bayer 4×4 matrix | Patterned/retro |

All support both 1-bit and 2-bit quantization.

## User flow

1. Open app (no server needed, just `npm run dev`)
2. Click "Choose files" → select images or .cbz from file picker
3. Each image loads in PreviewPanel with:
   - Overlay showing the 5 slice rectangles with numbering
   - Slice strip at bottom showing dithered previews of each slice
   - Per-image orientation toggle (portrait/landscape)
   - Slice info: dimensions + count
4. Sidebar shows ConfigPanel (device, dither, contrast, color depth) + ImageList + BatchPanel
5. Click "Convert to XTC" in BatchPanel → processes all images → downloads .xtc

## What to verify after changes

```bash
cd comic-slicer
npm install
npx tsc -b           # TypeScript check (zero errors)
npx vite build        # Production build (zero warnings)
npm run dev           # Dev server at http://localhost:5173
```

## Known state (as of last session)

- Project builds clean (TypeScript + Vite, zero errors)
- Express server removed, fully client-side via File API
- CBZ loading works via JSZip (dynamic import in BatchPanel)
- The 5-slice algorithm handles portrait, landscape, and short images
- Preview shows interactive overlay with slice selection
- Batch processing loads each image, slices, processes, and outputs XTC

## Remaining / potential work

- Test with real hardware (Xteink X4/X3) — verify .xtc renders correctly
- Progress indicator during batch conversion (currently shows count but could be more visual)
- Drag-and-drop file input (currently only click-to-browse)
- Handle very large batches (100+ pages at 2K resolution) — may need Web Workers
