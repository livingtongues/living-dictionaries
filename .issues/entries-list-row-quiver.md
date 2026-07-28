# Entries list rows quiver (Iquito, reported 2026-07-27)

**Status: DONE, signed off by Jacob 2026-07-28. Uncommitted — Jacob commits.**

- ✅ Reproduced on prod and locally (measured, not eyeballed)
- ✅ Root cause identified (measure→style→measure loop + non-square thumbs)
- ✅ Fixed with a pure-CSS container query; every row now holds one stable height
- ✅ `pnpm check` (clean for this file), `vitest` 2240 passed, eslint clean, stories re-shot
- ✅ Jacob approved the visual delta: keep the uniform 104px minimum for media rows
- ✅ Decided AGAINST an automated regression check — the loop is now structurally impossible,
  and the rule lives in the CSS comment + `.knowledge/svelte/layout-measure-feedback-loops.md`

Reported: on `livingdictionaries.app/iquito/entries` (mobile) the top rows of the list
vibrate up and down continuously. Started "about a week ago" — the redesign in
`318f621f` (2026-07-24, "redesign entry list with enhanced media display") introduced it.

## Root cause — a measure→style→measure layout loop

`ListEntry.svelte` measured its own row (`bind:clientHeight={row_height}`) and fed that
measurement straight back into the row's own layout:

- `media_floating = row_height > 104` → switched the media rail between FLUSH (full-bleed) and
  FLOATING (5.5rem centered thumb),
- `--flush-thumb-width = min(row_height, 104)px` → the flush thumb's width.

The photo `<img>` inside the thumb is `width:100%; height:100%`, so for **intrinsic sizing** the
browser used the image's natural aspect: thumb height = width × (natural_h / natural_w). With a
**portrait** thumbnail that height exceeds the width, so:

```
flush  → thumb width 104 → image height 104·k (k>1) → row = 104·k  (e.g. 126.8)
row > 104 → floating → thumb 88×88, rail no longer stretches → row = 88+16 = 104
row ≤ 104 → flush → …forever, at 60fps
```

Measured on prod AND reproduced locally, byte-identical:

| entry | thumb natural | row heights observed |
|---|---|---|
| áàjà | 288×351 | 104 ⇄ 126.8 |
| áájììti | 288×336 | 104 ⇄ 121.3 |

Only rows whose thumb is **taller than wide** and whose text is short enough to sit under the
104px cap oscillate — which is why it hit the top of the Iquito list and not the bottom.

### Why thumbs aren't square
`photo-variants.ts` generates `thumb` with `{ width: 400, height: 400, fit: 'cover',
withoutEnlargement: true }`. `withoutEnlargement` means a source smaller than 400px is never
upscaled/cropped to a square — it keeps its aspect. Most Iquito thumbs are 288×N (N = 216…351).
So non-square thumbs are normal and expected, not a data defect.

## Fix (pure CSS, no measurement)

`site/src/routes/[dictionaryId]/entries/list/ListEntry.svelte`:

1. Deleted `row_height` / `media_floating` / `flush_thumb_width` and the `bind:clientHeight`.
2. New wrapper `.media-slot` — `align-self: stretch`, **fixed** width
   (`--thumb-count × 6.5rem + gaps`), `container-type: size`.
   - Fixed width ⇒ the text column's width never changes with the rail ⇒ no wrap feedback.
   - `container-type: size` ⇒ nothing inside can influence the row's height.
3. `.media-rail` is now `position: absolute; inset: 0` inside the slot ⇒ an image's natural
   aspect ratio can never feed back into the row height.
4. The FLUSH ⇄ FLOATING switch is a size container query: `@container (height > 6.5rem)` →
   thumbs become 5.5rem rounded squares, vertically centered, inset 0.625rem from the right edge
   (exactly the old floating look).
5. `.entry-row.has-media { min-height: 6.5rem }` — since media no longer contributes height,
   this keeps short cards showing a full 104px square.

### Visual delta (worth Jacob's eye)
- Media rows are now **always ≥104px tall** with a 104×104 flush thumb. Before, a short row could
  be as small as 82px with an 82×82 thumb, i.e. the list is slightly more uniform now.
- In floating mode the text column is ~16px narrower per thumb than before (the slot keeps the
  flush footprint so the width can't oscillate).

## Verification

- `/tmp/quiver3.mjs` (throwaway): loads the entries list, samples every `.entry-row`'s height over
  60 animation frames, reports rows with more than one distinct height.
  - Before: `áàjà [104, 126.8]`, `áájììti [121.3, 104]`.
  - After: every row a single stable height (104 or 117.8).
- Screenshots at 390px (light + dark) and 1000px: flush squares on short rows, rounded inset
  thumbs on tall rows.
- `pnpm check`: clean for this file (the one error, `src/routes/og/+server.ts`, belongs to another
  agent's in-flight work).
- svelte-look stories `FloatingRailTallCard` / `MobileEditorAllMedia` render correctly.

### How to re-run the repro locally
1. `iquito` was seeded into the local catalog so the local dev server can serve it — the viewer
   path pulls the real snapshot from prod R2 and `/api/dev-media` 302s photos to R2:
   ```sh
   sqlite3 site/.data/shared.db "INSERT OR REPLACE INTO dictionaries (id,url,name,gloss_languages,public,entry_count,created_at,updated_at) VALUES ('iquito','iquito','Iquito Living Dictionary','[\"es\",\"en\"]',1,632,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');"
   ```
2. `pnpm dev` (port 3041) → `http://localhost:3041/iquito/entries`.
3. **Set a real browser user-agent in puppeteer.** A `HeadlessChrome` UA is classified as a robot
   in production and the dictionary database never boots (empty list, no `.entry-row`). Dev is
   exempt, prod is not.
