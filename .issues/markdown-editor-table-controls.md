# MarkdownEditor table controls (insert / row / column / header / merge)

Approved by Jacob 2026-08-01. Give managers (and admins) a way to create and edit tables in
grammar sections and about pages. `TableKit` is already loaded in the shared Tiptap extension
set — all the commands exist; what's missing is UI.

## Decisions (settled — do not re-open)

- **Serialization: keep the existing hybrid, no custom syntax.** `tiptap-markdown` already emits
  a GFM pipe table when a table is "simple" (first row all header cells, no spans, every cell a
  single paragraph — see `isMarkdownSerializable` in its dist) and falls back to raw HTML
  (cleaned by `clean_table_markup`) otherwise. This is the desired contract: markdown when
  markdown can say it, HTML when only HTML can (colspan/rowspan/header-column paradigm tables).
  Do NOT invent a span syntax, do NOT force GFM.
- **UI: contextual second toolbar row** (option A) — when the caret is inside a table, a second
  toolbar row appears under the main toolbar with the table operations. No floating bubble menu,
  no hover grips.
- **Operations: core + header toggles + merge/split** (see list below).
- **Insert: one click inserts a 3×3 table with header row** (`insertTable({ rows: 3, cols: 3,
  withHeaderRow: true })`). No grid-size picker.
- **Scope: the "insert table" button appears only in the `document` preset** (grammar/about).
  BUT the contextual row-ops toolbar must appear in BOTH presets whenever the caret is inside a
  table — legacy HTML tables can exist in any field (317 migrated values), and they must be
  editable wherever they are.
- **LD only this session.** house has the identical gap (TableKit, no UI) — do not port now;
  the nightly parity sweep / a follow-up session handles it. Note: `MarkdownEditor.svelte` is
  NOT in the house PARITY.md worker manifest, so no parity test will complain.

## Where

All work is in `site/src/lib/markdown/`:

- `MarkdownEditor.svelte` — toolbar + contextual table row + editor CSS
- `MarkdownEditor.stories.ts` — new stories
- `extensions.ts` — probably untouched (TableKit already configured, `resizable: false`)

Grammar sections use this editor via `routes/[dictionaryId]/grammar/SectionEditor.svelte`
(dynamic import); about pages likewise. No route changes needed.

## Implementation

### 1. Main-toolbar "Insert table" button (`document` preset only)

- Icon: `~icons/mdi/table-plus` (unplugin-icons, like the rest of the toolbar).
- Place it next to the image button in the `document`-preset group.
- `onclick`: `editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()`
- Disable (like the others) when `disabled || !editor`; ALSO disable when the caret is already
  inside a table (`in_table`) — nested tables are nonsense here.

### 2. Contextual table toolbar row (both presets)

Derived visibility using the existing tick pattern (`$derived.by(() => { void tick.value; … })`):

```ts
const in_table = $derived.by(() => { void tick.value; return editor?.isActive('table') ?? false })
```

When `in_table`, render a SECOND `.toolbar` row (same button styles — reuse the existing
`.toolbar button` CSS by using the same class; a `.table-toolbar` modifier for the subtle
tinted background like the mockup, e.g. `background: color-mix(in srgb, var(--primary) 8%,
var(--surface))`). Buttons, left to right, mdi icons in parens:

| Button | Command | Icon suggestion |
|---|---|---|
| Add row below | `addRowAfter()` | `mdi/table-row-plus-after` |
| Delete row | `deleteRow()` | `mdi/table-row-remove` |
| Add column right | `addColumnAfter()` | `mdi/table-column-plus-after` |
| Delete column | `deleteColumn()` | `mdi/table-column-remove` |
| — separator — | | |
| Toggle header row | `toggleHeaderRow()` | `mdi/table-headers-eye` or `mdi/format-header-pound` — pick something sensible from mdi's table set |
| Toggle header column | `toggleHeaderColumn()` | `mdi/table-column` |
| Merge cells | `mergeCells()` | `mdi/table-merge-cells` |
| Split cell | `splitCell()` | `mdi/table-split-cell` |
| — separator — | | |
| Delete table | `deleteTable()` | `mdi/table-remove` |

Notes:
- All handlers: `editor?.chain().focus().<cmd>().run()` — follow the existing extracted-function
  style at the top of the script block.
- Merge/split enablement: use `editor.can().mergeCells()` / `editor.can().splitCell()` (tick-derived)
  to disable when not applicable (merge needs a multi-cell selection; split needs a spanned cell).
  Cheap and accurate — don't hand-roll selection inspection.
- `title` + `aria-label` on every button like the existing ones. Hardcoded English strings are
  what the current toolbar uses (`title="Bold (Ctrl+B)"`) — stay consistent, no i18n keys.
- Keep tooltips descriptive: "Add row below", "Delete row", etc.

### 3. Editor CSS for tables

The editor mount needs table + selection styling (scoped `:global(.markdown-editor .ProseMirror …)`
like the existing rules):

- `table` — `border-collapse: collapse; width: 100%; table-layout: fixed;` margin like tw-prose.
- `td, th` — `border: 1px solid var(--border-color); padding: 0.25rem 0.5rem; vertical-align: top;
  position: relative;` `th` gets `font-weight: 600; background: var(--surface);` (theme vars only —
  must look right in dark mode; check `theme.css` for the var names actually available).
- `.selectedCell::after` — ProseMirror's cell-selection overlay: absolutely-positioned inset
  overlay with `background: color-mix(in srgb, var(--primary) 18%, transparent); pointer-events:
  none;` (the standard tiptap pattern). Without this, drag-selecting cells for merge is invisible.
- `.column-resize-handle` styling is NOT needed (`resizable: false`).
- Check `$lib/typography.css` (`tw-prose`) — if it already styles tables, reuse/don't fight it;
  the editor content div has class `tw-prose markdown-editor-content`. Rendered display sites go
  through the same tw-prose, so display styling may already exist. Only add what's missing for
  the EDITING affordances (selectedCell overlay especially).

### 4. Cell-selection for merge

TableKit ships ProseMirror `tableEditing` — drag across cells already creates a CellSelection;
Tab/Shift-Tab navigate cells; these come free. Just verify they work; no code expected.

## Verification (do all of these)

1. **Round-trip unit test** — extend `site/src/lib/markdown/markdown-roundtrip.test.ts`:
   - A simple 3×3 table with header row serializes to a **GFM pipe table** (assert on the pipe
     markdown, no `<table` substring).
   - A table with a `colspan="2"` cell (or header column) serializes as **HTML** and survives a
     load→serialize round trip unchanged (after `clean_table_markup`).
2. **Stories + screenshots** — add to `MarkdownEditor.stories.ts`:
   - `WithSimpleTable` — value containing a GFM pipe table.
   - `WithParadigmTable` — value containing an HTML table with colspan + header column (mimic a
     real migrated paradigm table).
   Screenshot both via svelte-look; verify table borders/headers render, light AND dark flavors
   if the stories file has flavors (follow the svelte-ui skill).
3. **Interactive browser test** (browser-tools skill + dev-auth skill, dev server port 3041):
   log in as a manager, open a dictionary grammar section editor (or the about-page editor),
   then: insert a table → type in cells → add row → add column → toggle header column →
   drag-select two cells → merge → save. Reopen the editor and confirm the table persisted
   (merged cell intact → it round-tripped as HTML). Also confirm the contextual toolbar does
   NOT show when the caret is in normal prose, and DOES show inside a legacy table in a
   `minimal`-preset field if you can find/set up one (a notes field with a pasted table).
4. `pnpm test`, `tsc`, `pnpm lint`, `pnpm check` in `site/`.

## Follow-ups (do not do now — just leave these notes)

- Port the same controls to house's MarkdownEditor (same gap, same fix).
- `.issues/future/markdown-tables.md` (legacy HTML→GFM conversion sweep) is now simpler: only
  convert tables that pass the same "simple" test; span tables stay HTML by design.

## Status

Implementation started 2026-08-01 on mustang. Verification will use svelte-look light/dark
screenshots plus an isolated headless Chromium session authenticated through the dev OTP flow.

- [x] Insert-table button (document preset) ✅
- [x] Contextual table toolbar (both presets) ✅
- [x] Editor table CSS + selectedCell overlay ✅
- [x] Round-trip tests (GFM simple / HTML spans) ✅
- [x] Stories + svelte-look screenshots ✅
- [x] Browser end-to-end pass incl. save/reload persistence ✅
- [x] pnpm test / tsc / lint / check ✅

## Lessons learned

- `$lib/typography.css` intentionally makes rendered tables content-width and border-light. The
  editor needs a more spreadsheet-like override (`display: table`, fixed full width, bordered
  cells), so those rules stay scoped to `.markdown-editor .ProseMirror` and do not change display
  sites.
- Focusing a table cell in each CSR story is necessary to screenshot the contextual toolbar;
  otherwise Tiptap leaves the initial selection in the heading/prose before the table.
- Browser verification used the seeded `dev` grammar editor as `dev-manager@example.com`: it
  inserted a 3×3 table, edited cells, added a row and column, toggled the header column,
  drag-selected and merged two cells, saved, reloaded, and confirmed the `colspan="2"` survived.
  There were no page or console errors. A minimal-preset legacy-table story verifies the same
  contextual controls appear without exposing the insert-table action.
- Final verification: all 333 Vitest files passed (2,483 tests; 1 file / 4 tests skipped),
  `tsc --noEmit` passed, `svelte-check` passed, and the root ESLint command passed. The site
  package has no `lint` script, so its direct `pnpm lint` resolves an unrelated system binary;
  the repository's canonical root `pnpm lint` is the working lint command.
