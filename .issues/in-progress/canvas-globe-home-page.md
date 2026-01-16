---
title: Replace Mapbox with Canvas-based Globe on Home Page
type: feature
priority: 1
assignee: jacob
---

## Overview

Replace the Mapbox-based globe view on the home page (`/packages/site/src/routes/+page.svelte`) with a Canvas-based D3 orthographic projection globe from the svelte-globe example project. Mapbox will remain for all other pages in the project.

## Source Reference

The globe implementation comes from `/home/jacob/code/examples/svelte-globe/src/routes/+page.svelte` and its associated components in `$lib/components/`.

## Files to Create

### Globe Components (in `$lib/components/globe/`)
- `Canvas.svelte` - Canvas context provider
- `Globe.svelte` - D3 orthographic projection with land/borders rendering
- `Zoomer.svelte` - Versor-based drag/zoom interactions
- `DictionaryPoints.svelte` - Render dictionary points (adapted for dictionary data)

### Utility Files (in `$lib/components/globe/utils/`)
- `versor-zoom.ts` - Versor zoom behavior
- `scale-canvas.ts` - HiDPI canvas scaling

### Data Files (in `$lib/components/globe/data/`)
- `land-110m.json` - Low-res land for movement
- `land-50m.json` - High-res land for static
- `countries-110m.json` - Low-res borders
- `countries-50m.json` - High-res borders

### Constants
- `$lib/components/globe/constants.ts` - CANVAS_CONTEXT_NAME

### Documentation
- `.issues/done/mapbox-home-globe-legacy.md` - Document legacy Mapbox implementation

## Files to Modify

- `/packages/site/src/routes/+page.svelte` - Replace Mapbox with new Globe components

## Dependencies to Add

- `versor` - For drag rotation with versor quaternions
- `d3-force` - For label collision detection (if not already present)

## Key Adaptations

### DictionaryPoints.svelte
- Accept `dictionaries: DictionaryView[]` prop
- Map dictionary coordinates format (`dictionary.coordinates.points[0]`) to `[lng, lat]`
- Support `selectedDictionaryId` binding
- Handle click events for dictionary selection
- Distinguish public/private/personal dictionaries via color coding
- Support admin toggle for private dictionaries

### Globe.svelte
- Export `rotate_to(lng, lat)` method for centering on a dictionary
- Accept initial rotation based on `user_latitude`/`user_longitude` from page data

### Removed Features (NOT porting over)
- **Regions display**: The Mapbox version shows region polygons for selected dictionaries with multiple coordinate regions. Canvas rendering of arbitrary GeoJSON regions is complex; skipping for now.
- **Multiple markers for selected dictionary**: When a dictionary has multiple coordinate points, Mapbox shows all of them with the first in blue and others in black. The new globe will only highlight the primary point.

## Design Decisions

1. **Selected dictionary**: Just highlight the primary point, no regions display
2. **Zoom indicator**: Not needed, remove it
3. **Admin toggle**: Keep working for private dictionaries
4. **Initial view**: Center on user's geolocation (same as current Mapbox behavior)

## Task Checklist

- [ ] Document legacy Mapbox home page implementation
- [ ] Add `versor` and `d3-force` dependencies
- [ ] Copy utility files (scale-canvas.ts, versor-zoom.ts)
- [ ] Copy TopoJSON data files
- [ ] Create constants.ts
- [ ] Create/adapt Canvas.svelte
- [ ] Create/adapt Globe.svelte (add rotate_to method, initial rotation)
- [ ] Create/adapt Zoomer.svelte
- [ ] Create DictionaryPoints.svelte (adapted for dictionary data)
- [ ] Update +page.svelte to use new Globe components
- [ ] Test interactions and verify functionality
