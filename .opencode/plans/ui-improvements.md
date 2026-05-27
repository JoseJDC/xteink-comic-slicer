# UI/UX Improvements Plan

## Overview
Mejoras visuales y de usabilidad para Comic Slicer. Organizadas por esfuerzo/impacto.

---

## Tier 1 — Polish visual rápido (solo CSS)

### 1.1 Animación en overlay de slices
- Al seleccionar un slice, animar la transición del rectángulo resaltado (`transition: all 0.2s`)
- En lugar de saltar entre posiciones, que el rectángulo se deslice suavemente

### 1.2 Sombra y profundidad en paneles
- Agregar `box-shadow` sutil a `.config-panel`, `.image-list`, `.batch-panel`, `.preview-canvas-container`
- Usar sombras múltiples para efecto de elevación (raised surface)

### 1.3 Hover en thumbnails del strip
- `transform: scale(1.05)` + `transition: transform 0.15s` en `.slice-thumb:hover`
- Sutil elevación con sombra al hover

### 1.4 Transición entre imágenes
- Fade in/out (`opacity` + `transition`) al cambiar de imagen en el preview
- Usar `key` en PreviewPanel para triggerear CSS transition

### 1.5 Progress bar mejorada
- Aumentar height de 4px → 8px
- Agregar `box-shadow` con color del accent para glow effect
- Animación de rayas (striped) durante la conversión con `background-image: linear-gradient`

### 1.6 Empty state mejorado
- Reemplazar emoji 🎨 por SVG inline simple e ilustrativo
- Mejor copy con instrucciones claras

### 1.7 Tooltips en controles
- Agregar `title` attributes en todos los botones y selects del ConfigPanel
- Explicar qué hace cada opción

### 1.8 Scrollbar refinada
- Scrollbar un poco más ancha (8px)
- Border-radius: 4px
- Track semi-transparente

---

## Tier 2 — UX medio (CSS + React)

### 2.1 Drag & drop
- Zona de soltar archivos en el área vacía
- Overlay visual al arrastrar (dashed border, fondo semi-transparente)
- Aceptar imágenes y .cbz

### 2.2 Loading skeleton
- Reemplazar "Loading image..." por un esqueleto animado (pulse/shimmer)
- Placeholder con dimensiones del contenedor

### 2.3 Atajos de teclado
- `←` / `→`: Navegar entre imágenes
- `Space`: Abrir/cerrar el modal de slice preview
- `R`: Rotar orientación de la imagen actual
- `Escape`: Cerrar modal (ya implementado)

### 2.4 Tooltips mejorados en slice strip
- Al hover en thumbnail, mostrar tooltip con estadísticas del slice (dimensiones originales, offset Y, % de solapamiento)
- Usar un div posicionado (no title attribute) para mejor control visual

### 2.5 Contador de slices en overlay
- Mostrar "Slice 2/5" en el propio overlay o en el modal permanentemente
- Flechas `◀` `▶` para navegar slices dentro del modal

### 2.6 Toggle original vs procesado en modal
- Botón en el modal para switchear entre el slice original (sin dither) y el procesado
- Útil para apreciar el efecto del dithering

---

## Tier 3 — Features grandes

### 3.1 Sidebar colapsable
- Botón con icono de hamburguesa/chevron en el header
- Sidebar se colapsa a la izquierda (0 width) y el preview ocupa todo el espacio
- Animación de transición en el width

### 3.2 Modo side-by-side
- Vista dividida horizontal: imagen original (con overlay de slices) a la izquierda, procesado a la derecha
- Sincronizado: mismo slice seleccionado en ambas vistas
- Toggle button para activar/desactivar

### 3.3 Tema claro/oscuro
- Toggle en el header
- CSS custom properties para todos los colores
- Paleta clara: fondos blancos/grises claros, texto oscuro
- Persistir preferencia en localStorage

### 3.4 Zoom/Pan en preview
- Click + arrastrar para panear
- Scroll wheel o botones +/- para zoom
- Mostrar nivel de zoom actual
- Reset zoom con doble click

### 3.5 Perfiles de configuración
- Botón "Save preset" / "Load preset"
- Guardar combinación de device + dither + contraste + color depth
- Almacenar en localStorage
- Nombrar perfiles personalizados

---

## Implementation order

1. **Tier 1.1-1.7** — polish visual rápido, alto impacto, bajo riesgo
2. **Tier 2.1** (drag & drop) + **2.2** (skeleton) — UX que más se nota
3. **Tier 2.3-2.6** — refinamientos de interacción
4. **Tier 3** — features grandes, evaluar después de los tiers anteriores

## Files to modify

| File | Changes |
|------|---------|
| `src/App.css` | Todos los cambios CSS (Tier 1 + Tier 2 visual) |
| `src/App.tsx` | Drag & drop handler, keyboard shortcuts, sidebar toggle state |
| `src/components/PreviewPanel.tsx` | Atajos de teclado, navegación en modal, toggle original/processed |
| `src/components/ConfigPanel.tsx` | Tooltips, drag & drop visual indicator |
| `src/components/BatchPanel.tsx` | Progress bar mejorada |
