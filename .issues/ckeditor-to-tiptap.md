# CKEditor → Tiptap-markdown migration

Decided with Jacob 2026-07-02 (deps-review follow-up): **markdown storage** (house LibraryEditor
pattern) · **all three fields at once** (dictionary `about`, dictionary `grammar`, entry `notes`) ·
**editor swap lands on `svelte-5-migration` now; HTML→markdown conversion runs inside the Supabase
cutover migration** (no separate prod backfill ever) · no Supabase reads before cutover — instead
the cutover gains a **thorough content audit** step (see `.issues/cutover.md` §2a, added same day).

## Why

- Kills the last CKEditor usage → drops `ckeditor5-build-classic-with-alignment-underline-smallcaps`
  AND the deprecated `@types/ckeditor__ckeditor5-core` (39MB, source of 2 CRITICAL + ~15 HIGH audit
  findings via its ckeditor5 runtime-collab dependency tree).
- Markdown is the agent-parity format: `/api/v1` writers get markdown, not CKEditor HTML.
- House already walked this exact road (articles, 2026-06/07) — its converter, extension set, and
  renderer are battle-tested and port directly (both repos: Svelte 5, Tiptap ^3.26).

## Current state (all verified in code 2026-07-02)

| Site | Field | Storage | Notes |
|---|---|---|---|
| `routes/[dictionaryId]/about/+page.svelte` | `dictionaries.about` | HTML text col | rendered `{@html sanitize(...)}` into `.tw-prose`; has img/figure styling |
| `routes/[dictionaryId]/grammar/+page.svelte` | `dictionaries.grammar` | HTML text col | same shape as about |
| `lib/components/entry/EditField.svelte` (`field === 'notes'` only) | `entries.notes` | **MultiString JSON** `{ locale: html }` | editor wrapped in `<Keyman fixed target=".ck-editor__editable_inline">` |

- Editor chain: `ClassicCustomized.svelte` → `CKEditor.svelte` → dynamic import of the classic build.
- LD **already has** house's HTML-Tiptap `RichTextEditor.svelte` (`$lib/svelte-pieces/`, used by
  admin chat/reply composers) — keep it for those; this migration adds the *markdown* editor.
- Cutover mappers pass the HTML through untouched today: `scripts/supabase-cutover/mappers.ts`
  `about`/`grammar` (~line 216) from `dictionary_info`, `map_entry` `notes` (~line 282).
- v1 API already writes `notes` (`site/src/lib/db/server/v1-entry-write.ts`).

## What to port from house (`~/code/house/site/src/lib/markdown/`)

One shared extension set is the heart of it — editor, reader render, and converter all use the SAME
set so content round-trips byte-stable (house's "no spurious first-save churn" property):

- `extensions.ts` → `create_extensions()` — StarterKit (headings 1–3, `underline: false`),
  `tiptap-markdown` (`html: true`), + only what the LD content needs. Start with **StarterKit +
  Image + Link + Placeholder**; add `SmallCaps` (Pandoc-span mark) only if the cutover audit finds
  small-caps in real content (the CKEditor build's name says the button existed; usage unknown).
  Deliberate drops, matching house: **text-align, underline** (DOMParser silently drops what has no
  extension).
- `LibraryEditor.svelte` → LD name it `MarkdownEditor.svelte` in `site/src/lib/markdown/`. Strip
  house-isms: no `house-image:<id>` indirection (LD images are stable lh3/GCS URLs → plain
  `@tiptap/extension-image` with `![](url)`), no Footnote (unless audit finds any), keep the
  toolbar-preset idea (about/grammar want headings/lists/image; notes wants a minimal preset).
- `html-to-markdown.ts` — the two-step converter (`@tiptap/html generateJSON` → headless Editor →
  `get_editor_markdown`). Needs a DOM: browser has one; the **cutover script runs it under
  happy-dom** (house's `backfill/` shows the server-side pattern).
- `render.ts` — markdown-it renderer (+ `markdown-it-pandoc-spans` if SmallCaps is kept). Reader
  pages switch from `{@html sanitize(html)}` to `{@html sanitize(render_markdown_to_html(md))}` —
  KEEP `sanitize()`: LD content is manager-authored by many external users, not Jacob-trusted like
  house articles.
- Tests: house's `markdown-roundtrip.test.ts` pattern — port with LD-shaped fixtures.

New deps (site): `tiptap-markdown`, `@tiptap/html`, `@tiptap/extension-image`, `markdown-it`
(+ happy-dom already present). Removed deps: the two ckeditor packages.

## Work plan

### Phase 1 — editor swap on `svelte-5-migration` (✅ DONE 2026-07-02)

Working checklist (details in numbered plan below):
- ✅ `site/src/lib/markdown/`: extensions.ts, MarkdownEditor.svelte (+stories), render.ts,
      html-to-markdown.ts, html-era-shim.ts, markdown-roundtrip.test.ts (16 tests)
- ✅ Swap about/+page.svelte + grammar/+page.svelte (edit → markdown, display → render+shim;
      kept the original `updated || dictionary.x` display semantics — the layout `dictionary`
      stays cached after save, `updated` is what shows the fresh content)
- ✅ Swap EditField.svelte notes branch + retarget Keyman to `.ProseMirror`; fixed Keyman
      `resolve()` bug + teardown flag + interval cleanup (closes `.issues/keyman-keyboard-mount-race.md`)
- ✅ Other notes render sites: EntryField.svelte, PrintEntry.svelte, prepareEntriesForCsv.ts
      (table Cell.svelte edits raw value in a Textbox — fine as markdown, no change)
- ✅ Removed CKEditor.svelte + ClassicCustomized.svelte + 2 ckeditor deps + `.ck-*` CSS;
      added tiptap-markdown 0.9, @tiptap/html, @tiptap/extension-image, markdown-it 14
      (+@types dev). All @tiptap/* aligned at ^3.27.1. Audit: 2 crit + ~15 high → **0 crit, 5 high**
      (remaining are unrelated dep chains).
- ✅ openapi.ts: `notes` documented as MARKDOWN on EntryInput/EntryPatch/EntryMain; Keyman.md examples
- ✅ Verified: unit tests green (1020), svelte-check/lint clean on all touched files, svelte-look
      screenshots (editor presets, about/grammar all stories incl. HtmlEraContent), and a NEW e2e
      `pnpm -F site test:markdown` (e2e/markdown-editor-flow.mjs) — full PASS: html-era shim render →
      Edit converts to markdown (underline dropped) → Save persists markdown → notes modal Tiptap →
      **Keyman Assamese mapped physical keys into ProseMirror (typed কুকুরা)** → markdown notes
      render rich + sync to server dict db.

Lessons / discoveries (2026-07-02 execution):
- **Tiptap Image defaults `allowBase64: false`** — silently DROPS data-URI images. We enable it so
  legacy pasted-in-CKEditor base64 images survive conversion. markdown-it's link validator still
  restricts data URIs to png/jpeg/gif/webp (svg data URIs won't render).
- **ProseMirror fires a blur transaction synchronously during editor teardown**, inside Svelte's
  template/derived context → a bare `tick++` in `onTransaction` throws `state_unsafe_mutation`
  when the editor unmounts (e.g. Save closes the edit pane). Fixed with a destroying flag +
  `queueMicrotask` defer. Checked house's `LibraryEditor.svelte` — already carries the identical
  `queueMicrotask` + `isDestroyed` guard (commit `6755d94`, same day, house's own CKEditor→Tiptap
  migration) — no porting needed.
- **Bare local `node build` can't hydrate dict routes**: no snapshot source (no R2 env, and the
  dev-vps snapshot fallback is dev-only) → the dict layout's client load hangs → ALL interactivity
  on dict pages dead (root layout buttons included). Cost an hour of debugging; documented in
  site/e2e/E2E.md. e2e flows that click around dict routes must target `vite dev`.
- Keyman OSK renders as a collapsed gray box in headless Chromium (pre-existing KMW quirk) — verify
  the keyboard pipeline via PHYSICAL keystrokes (kmw maps latin keys → script chars) instead of
  clicking OSK keys.

Implementation decisions made during execution:
- Presets: `document` (about/grammar: H1–3, bold/italic/link, lists/quote/hr, image-by-URL
  prompt, undo/redo) vs `minimal` (notes: bold/italic/link, lists/quote, undo/redo). Underline +
  alignment + smallCaps buttons deliberately dropped (smallCaps pending cutover audit).
- MarkdownEditor uses STATIC tiptap imports (unlike house's dynamic) — code-splitting still happens
  because every usage site dynamic-imports the component itself; static means the editor mounts
  synchronously in onMount, so child-mounts-before-parent ordering hands Keyman a ready
  `.ProseMirror` target.
- Read-time shim renders HTML-era content AS HTML (no DOM-needing conversion in SSR);
  `html_to_markdown` only runs client-side at edit-open time.
- markdown-it (not the existing `marked` dep) for rendering — matches house + tiptap-markdown's
  internal parser for byte-stable round-trips.

#### Original plan
1. Port the markdown module (`site/src/lib/markdown/`: extensions, MarkdownEditor.svelte, render,
   html-to-markdown + roundtrip tests). `pnpm -F site test` green.
2. Swap the three usage sites to `MarkdownEditor`:
   - about/grammar pages: bind markdown value; render via `render_markdown_to_html`.
   - `EditField.svelte` notes: same, **re-target Keyman** — replace
     `target=".ck-editor__editable_inline"` with the ProseMirror contenteditable
     (`.tiptap [contenteditable]` / the editor element ref), and simplify
     `waitForCKEditorToInitAndBeTargeted` (Tiptap mounts synchronously in onMount — this can likely
     also close `.issues/keyman-keyboard-mount-race.md`). Manually verify a Keyman keyboard types
     into notes (Jacob or emulator/browser session on :3041).
3. **Transition tolerance**: existing rows (staging + any pre-cutover prod-format data) are HTML.
   Renderer + editor must not garble HTML-era content encountered before conversion runs:
   cheap heuristic `looks_like_html()` (leading `<`) → run `html_to_markdown()` on READ (in-memory,
   not written back) so the page renders and an edit-save naturally persists markdown. Delete this
   shim post-cutover.
4. Remove `CKEditor.svelte`, `ClassicCustomized.svelte`, both ckeditor deps, the `.ck-*` CSS bits;
   `pnpm install` + full `pnpm check` + audit (expect −2 crit / −15 high / −39MB).
5. Update `openapi.json` / v1 docs: `notes`, `about`, `grammar` are **markdown** fields now.

### Phase 2 — conversion inside the cutover migration (runs at cutover time)
Owned by `.issues/cutover.md` §2a (added 2026-07-02) — summary: content **audit** (tag/style/attr
frequency scan across ALL about/grammar/notes HTML, per-locale for notes) → extend the extension
set for anything real content needs → convert via the SAME `html_to_markdown` in mappers
(`about`, `grammar`, each `notes` locale value) → **verify** (round-trip render text-content
comparison + flagged-sample eyeball) → migrate. Audit + conversion decisions get recorded in the
cutover run log.

### Phase 3 — post-cutover cleanup
- Delete the read-time HTML shim (Phase 1.3).
- `.knowledge/` note: content model is markdown; SmallCaps/etc decisions from the audit.

## Gotchas / notes
- `entries.notes` is **MultiString** — convert every locale value independently; empty-string
  locales should map to absent keys (don't store `''` markdown).
- History DBs: pre-cutover history rows keep HTML snapshots — acceptable (history viewer shows raw
  text); do NOT convert history.
- house `Editor` instances must be `$state.raw` in Svelte 5 (deep proxy breaks Tiptap) — already
  handled in the ported components, don't "fix" it.
- `citation` / `write_in_collaborators` are NOT rich text — leave alone.
- The staging subset DBs have zero about/grammar content — Phase 1 verification needs a manually
  seeded row (paste a real dictionary's about HTML from prod UI into staging).
