# Home preview: interpolated line opacity + dict labels at dots

Jacob's spec (2026-07-04):

- Card connector lines get continuous opacity by distance from strip center:
  100% center → ~70% one card out → ~20% two out → →0 beyond (piecewise-linear falloff,
  same defaults across screen widths — wide screens just extend the tail).
- The near-center card's map dot shows a label: "Dict Name · 2,592 entries".
  Label opacity crossfades with line opacity remapped `(opacity − 0.6) / 0.4` so
  effectively one label visible with soft handoffs.
- Hover/audio on a word card → that line + label at 100%, all others fade to 0 (~200ms).
  Mouse-out resumes scrolling/normal display (already handled by existing pause logic).
- Map dot hover → HTML tooltip pinned above dot: single = name + entry count;
  cluster = "{count} dictionaries — click to zoom". Click behavior unchanged.

## Plan
- ✅ WordCards: anchors return `index`, `offset_cards` (signed, in card widths from strip center), `active`
- ✅ HeroUnit: per-line opacity/label_opacity, dedupe per card keeping strongest, SVG `<text>` label at dot, stable keys (`card.id-index`), 200ms opacity transitions
- ✅ WorldMap: hover tooltip state from `find_cluster`, cleared on zoom/pointerleave, hidden when popover open for the same dict, flips below near top edge, x clamped
- ✅ i18n: added `home_v2.map_cluster_tooltip` to en.json
- ✅ Verified with svelte-look (Desktop, CardHover, DotHover stories added with puppeteer interactions) + check/lint clean

## Lessons
- Label remap needed steepening to `(opacity − 0.75) / 0.25` — at the original 0.6 threshold the resting ±1 neighbors (70% lines) held faint permanent labels instead of "one title showing".
- A dictionary with multiple featured cards would stack duplicate labels on one dot — `label_leader_by_dict` keeps only the strongest line's label per dict.
- DotHover story finds a dot by sweeping `mouse.move` over the canvas until `canvas.hover-dot` appears (dot positions depend on projection, not DOM).
