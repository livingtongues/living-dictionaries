---
title: Finish Svelte 5 Migration - Pre-merge Checklist
type: task
priority: 1
assignee: jacob
---

## Overview

The `svelte-5-migration` branch has ~393 changed files (202 `.svelte` files migrated). Before merging to main, we need to verify everything works correctly and clean up loose ends.

## Checklist

### 1. Supabase Migrations
- [ ] Check if `supabase/migrations/20260202101534_deletes-table.sql` has been pushed to production
  - This adds a `deletes` table for sync, with RLS policies and a trigger to cascade deletes
  - Run `supabase migration list` or check the Supabase dashboard to verify

### 2. Dictionary Functionality Verification
- [ ] Create a new dictionary (create-dictionary page was significantly rewritten)
- [ ] Add/edit/delete entries in an existing dictionary
- [ ] Verify entry search works
- [ ] Test audio playback and speaker metadata
- [ ] Test photo/video display on entries
- [ ] Verify dictionary settings pages work (about, contributors, etc.)
- [ ] Check dictionary synopsis/overview page and map (VisualMap was modified)
- [ ] Test dictionary roles/invites
- [ ] Verify import/export functionality

### 3. Homepage Map Resize
- [x] ✅ The canvas-based D3 globe (replaced Mapbox) needs to resize on window size change
  - Fixed: Made canvas `position: absolute` so it doesn't prevent flex container from shrinking
  - Fixed: Changed projection from `$derived` (which reset rotation on resize) to a stable mutable object that updates `fitExtent`/`clipExtent` reactively

### 4. Email Rendering (Svelte 5 SSR)
- [x] ✅ Verify email rendering works - already rewritten to use Svelte 5's `render()` from `svelte/server`, tested with Announcement component and produces valid 11KB HTML document
- [x] ✅ Svelte 5 comment markers (`<!--[-->`, `<!--]-->`, etc.) are properly stripped from output
- [ ] Two `.bak` files exist that should be cleaned up or removed:
  - `packages/site/src/routes/api/email/components/markdown/MarkdownToEmailHtml.bak`
  - `packages/site/src/routes/api/email/components/markdown/RenderToken.bak`

### 5. OG Image Generation
- [x] ✅ Verify OG image generation still works (`/og` route) - import changed from `kitbook` to local `$lib/lz/lz-string`
  - Fixed: `component-to-png.ts` was still using Svelte 4's `component.render(props)` API — updated to Svelte 5's `render()` from `svelte/server`
- [x] ✅ Test that OpenGraphImage and SvgGlobe render correctly - verified with test request, produces valid 1200x600 PNG

### 7. Config & Build Verification
- [ ] Run `pnpm check` (svelte-check) to verify no type errors from migration
- [x] ✅ Run `pnpm test` - 172 passed, 14 failed (all failures in pglite sync tests due to FK constraints, pre-existing)
- [x] ✅ Run `pnpm lint:fix` - auto-fixed ~393k formatting issues (JSON data files, semicolons, import order)
- [ ] Fix remaining 81 lint errors across 30 files (see plan below)
- [ ] Verify production build works (`pnpm build` in site package)
- [ ] `vitest.workspace.ts` was removed and replaced with root `vitest.config.ts` - verify test discovery still works

#### Remaining Lint Errors Plan (81 errors, 30 files)

**A. `style/max-statements-per-line` (21 errors) - split compound statements onto separate lines**
These are mostly from Svelte 5 migration where `$: foo = bar` became `let foo = $derived(bar)` with inline ternaries.
- `lib/components/audio/SelectAudio.svelte` (lines 53-55)
- `lib/components/entry/EntrySemanticDomains.svelte` (line 56)
- `lib/components/globe/DictionaryPoints.svelte` (lines 136, 138, 144)
- `lib/components/image/ImageDropZone.svelte` (lines 44-46)
- `lib/components/maps/CoordinatesModal.svelte` (line 73)
- `lib/components/maps/RegionModal.svelte` (line 92)
- `lib/components/ui/array/MultiSelect.svelte` (lines 121, 151)
- `lib/components/video/PasteVideoLink.svelte` (line 24)
- `lib/components/video/SelectVideo.svelte` (lines 37-39)
- `lib/svelte-pieces/Badge.svelte` (lines 34, 57)
- `lib/svelte-pieces/Form.svelte` (line 28)
- `routes/og/component-to-png.ts` (line 126)

**B. `ts/no-use-before-define` (18 errors) - reorder variable declarations**
Svelte 5 `$derived` references variables declared later in the script block.
- `lib/components/modals/Contact.svelte` (12 errors - lines 19-77)
- `lib/components/ui/array/MultiSelect.svelte` (6 errors - lines 76-82)
- `routes/[dictionaryId]/entries/+page.svelte` (3 errors - line 29)
- `lib/pglite/live/composite-changes.ts` (line 302)
- `routes/og/component-to-png.ts` (line 26)

**C. `ts/no-unused-expressions` (5 errors) - bare variable references for reactivity tracking**
In `DictionaryPoints.svelte` (lines 237-240) and `Keyman.svelte` (line 86), variables are referenced standalone to create reactive dependencies in `$effect`. This is intentional Svelte 5 pattern - add eslint-disable comments.

**D. `ts/no-empty-function` (5 errors) - add no-op comments or remove**
- `lib/export/checkForMissingKeysInHeaders.ts` (lines 27, 36)
- `lib/components/maps/mapbox/controls/CustomControl.svelte` (line 23 - `onRemove`)
- `routes/admin/+layout.ts` (lines 18-19 - `add_editor`, `remove_editor`)

**E. `style/no-tabs` (5 errors) - replace tabs with spaces**
- `lib/components/image/Image2.svelte` (lines 44-47)
- `routes/og/component-to-png.ts` (line 88)

**F. `svelte/indent` (4 errors) - fix indentation in Svelte templates**
- `lib/components/keyboards/ipa/IpaKeyboard.svelte` (lines 18, 31)
- `routes/og/OpenGraphImage.svelte` (lines 76, 82)

**G. `style/indent-binary-ops` (3 errors) - fix indentation of binary operations**
- `lib/components/globe/DictionaryPoints.svelte` (lines 100-101)
- `lib/components/keyboards/ipa/IpaKeyboard.svelte` (line 19)

**H. Individual fixes (misc, 1-2 each)**
- `lib/helpers/debounce.ts` - `ts/no-unsafe-function-type` and deprecated `@typescript-eslint/ban-types`: replace `Function` type with proper signature
- `routes/og/component-to-png.ts` - `ts/no-unsafe-function-type`: same `Function` type issue; `node/prefer-global/buffer`: use `import { Buffer } from 'buffer'`
- `lib/components/audio/RecordAudio.svelte` - `regexp/no-unused-capturing-group` (line 61), `require-await` (line 76)
- `lib/components/image/Image2.svelte` - `@typescript-eslint/no-unused-vars` (line 27), `require-await` (line 40)
- `lib/components/record/MediaStream.svelte` - `one-var` (line 12): split `let` declaration
- `lib/components/maps/mapbox/queue.ts` - `prefer-spread`: replace `.apply()` with spread
- `lib/lz/lz-string.test.ts` - `unicorn/no-new-array`: use `Array.from()` instead
- `routes/[dictionaryId]/+layout.svelte` - `svelte/derived-has-same-inputs-outputs` (line 12)
- `docs/data/Sub-Entries.md` and `lib/pglite/live/composite-changes.md` - parse errors in markdown code blocks (likely eslint trying to lint fenced code)

### 9. Auth & Navigation
- [ ] Test login/logout flow
- [ ] Verify locale switching (`/setlocale/[bcp]` was migrated)
- [ ] Check that `$app/state` replacements for `$app/stores` all work correctly (navigating, page, etc.)
- [ ] Verify service worker (had a line removed)

## Notes
- 202 Svelte files were modified in this branch
- Major architectural changes: PGlite local-first database, canvas globe, email SSR rewrite, svelte-pieces internalized
