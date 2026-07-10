# Dict home polish: snippets, stats pills, strip caps, search pill

From Jacob's review of the Gta dict home:

1. ✅ About/grammar snippets bleed markdown (`\[gaq\]`) — `text_snippet` only strips HTML but
   `dictionary.about` is markdown. Render via `render_markdown_to_html` first, then strip.
2. ✅ Snippets truncate too early (240 chars) — let text fill the panel and only ellipsize at
   overflow: raise the JS cap (2000, safety) + CSS `-webkit-line-clamp` (solo section = more
   lines, both sections = fewer). "Read more" moves out of the clamped `<p>` so it can't get
   clipped. SEO description keeps its own short 240-char snippet.
3. ✅ Stats tiles: while stats pending show ONLY entries + with_audio as pulsing placeholders;
   with_photos / with_video / speakers tiles only render once loaded AND > 0 (no more "0 with
   video"). Page jump accepted by Jacob.
4. ✅ Featured + recent strips: show up to 8 each (recent server fetch bumped to 12 so the
   featured-overlap filter still leaves 8).
5. ✅ Hero search input → button-styled pill that jumps to `/entries` and focuses the entries
   search input (goto with `state.focus_search`, new `App.PageState` key, `focus_search` prop
   threaded into entries `SearchInput`).

6. ✅ Semantic domains → DonutChart pie (extended shared `$lib/charts/DonutChart.svelte` with
   optional `on_select` + `wrap_labels` props — additive, other consumers untouched; port to
   house/tutor when useful). Admin-3 gating removed — shows publicly when >2 domains in use.
   Legend labels wrap at word boundaries; on mobile (≤640px) the pie is hidden entirely and the
   percentage legend carries it (Jacob's call). Click (wedge or legend row, keyboard too) →
   `/entries?q={"semantic_domains":["<facet key>"]}` — same underscored facet keys FilterList
   stores. New i18n key `dict_home.top_domains` (EN only, translations via /fill-translations).

## Verified
- vitest home-helpers + dict-home, tsc, svelte-check 0 errors, eslint clean on touched files.
- svelte-look: DomainsPanel stories (desktop pie + mobile legend-only, light/dark), home
  `+page` Visitor + LoadedStats (markdown resolved incl. `\[gaq\]` and `(**bold**)` spacing,
  2-placeholder pending stats, zero tiles hidden, public domains pie).
- Headless e2e vs dev :3041 (achi, 485 entries): search pill click → /entries with input
  FOCUSED (`page.state.focus_search`); stats tiles = entries|with audio|speakers (photos/video
  0 → hidden); domain legend click → entries filtered to Body parts, 30 results, checkbox
  checked; zero pageerrors. Script: /tmp/dict-home-e2e.mjs.

## Notes
- Two other agent sessions were concurrently editing this same page (MapPanel static-map
  rework + entry-card redesign) — my +page.svelte edits were re-applied after their writes;
  the gray map area in story screenshots is their WIP (map-static 404s under the dummy token).
- `text_snippet` now renders markdown (markdown-it) before stripping — `dictionary.about` /
  `grammar` are stored as markdown, not HTML. SEO description keeps a separate short
  240-char snippet; the display snippet is capped at 2000 chars + CSS line-clamp (4 lines
  shared / 9 lines solo).
