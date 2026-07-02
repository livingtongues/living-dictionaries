# Convert raw-HTML tables in rich text → real markdown tables

At the Supabase cutover (2026-07-02) legacy CKEditor tables (317 values, mostly grammar-page
paradigm charts — 7,462 cells) were preserved as **raw HTML blocks inside markdown** (house's
model: TableKit in the Tiptap editor, `html: true` markdown long-tail, `clean_table_markup`).
Jacob would prefer **real markdown (GFM) tables**.

Why it's its own session, not a mechanical sweep:
- GFM tables can't express `colspan`/`rowspan`, which some linguistic paradigm tables use —
  those need restructuring or staying as HTML.
- Cells can hold multi-block content (multiple `<p>`s) — GFM cells are single-line.
- The agent must EYEBALL before/after per table (Jacob: "some linguistic tables are more
  challenging than house charts").

Approach sketch: scan all markdown fields for `<table`; classify (simple grid vs spans/multi-block);
auto-convert the simple ones (render both, diff text + screenshot compare); leave/flag the complex
ones; report per-dictionary. `tiptap-markdown` has native GFM table serialization when cells are
simple — flipping the editor to emit GFM for NEW simple tables could ride along.
