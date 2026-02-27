---
title: Finish Svelte 5 Migration
type: task
priority: 1
assignee: jacob
---

## Overview

The `svelte-5-migration` branch has most files migrated but there are still files using Svelte 4 patterns that need updating. This issue tracks the remaining migration work and lint cleanup.

## Files Still Using Svelte 4 Patterns

### Components using `export let`, `$:`, `<slot>`, `$$props/$$restProps`, or `createEventDispatcher` (10 files)

- `lib/components/image/ImageDropZone.svelte` - `<slot>`
- `lib/components/keyboards/ipa/IpaKeyboard.svelte` - `export let`
- `lib/components/maps/CoordinatesModal.svelte` - `<slot>`
- `lib/components/record/MediaStream.svelte` - `export let`, `$:`, `svelte/store`
- `lib/components/record/Recorder.svelte` - `export let`, `$:`
- `lib/svelte-pieces/ShowHide.svelte` - `<slot>`
- `routes/dictionaries/+page.svelte` - `export let`
- `routes/[dictionaryId]/entries/table/cells/CheckboxCell.svelte` - `export let`, `createEventDispatcher`
- `routes/[dictionaryId]/entries/table/EntriesTable.svelte` - `export let`, `$:`
- `routes/+layout.svelte` - `export let`, `$:`

### Files using `$app/stores` (need `$app/state`) (10 files)

- `lib/components/audio/upload-audio.ts`
- `lib/components/image/upload-image.ts`
- `lib/components/video/upload-video.ts`
- `lib/helpers/media.ts`
- `lib/helpers/share.ts`
- `lib/helpers/vernacularName.ts`
- `lib/supabase/operations.ts`
- `lib/svelte-pieces/query-params-store.ts`
- `routes/[dictionaryId]/entries/table/setUpColumns.ts`
- `routes/[dictionaryId]/export/prepareEntriesForCsv.ts`

### Files using `svelte/store` (writable/readable/derived/get) (26 files)

These use Svelte stores that should be converted to `$state`/`$derived` runes or `$app/state`:

- `lib/components/audio/EditAudio.svelte`
- `lib/components/audio/UploadProgressBarStatus.svelte`
- `lib/components/audio/UploadProgressBarStatus.variants.ts`
- `lib/components/image/AddImage.svelte`
- `lib/components/image/AddImage.variants.ts`
- `lib/components/image/EditImage.svelte`
- `lib/components/image/image-store.ts`
- `lib/components/image/UploadImageStatus.svelte`
- `lib/components/maps/mapbox/queue.ts`
- `lib/components/ui/toast.ts`
- `lib/components/video/AddVideo.svelte`
- `lib/mocks/db.ts`
- `lib/mocks/layout.ts`
- `lib/search/entries-ui-store.ts`
- `lib/supabase/cached-query-data.ts`
- `lib/supabase/dictionaries.ts`
- `lib/supabase/user.ts`
- `lib/svelte-pieces/persisted-store.ts`
- `routes/admin/+layout.ts`
- `routes/create-dictionary/+page.ts`
- `routes/[dictionaryId]/about/_page.variants.ts`
- `routes/[dictionaryId]/contributors/Partners.svelte`
- `routes/[dictionaryId]/contributors/Partners.variants.ts`
- `routes/[dictionaryId]/entries/components/Audio.svelte`
- `routes/[dictionaryId]/entries/FilterList.variants.ts`
- `routes/[dictionaryId]/entries/View.svelte`
- `routes/[dictionaryId]/entry/[entryId]/+page.ts`
- `routes/[dictionaryId]/entry/[entryId]/_page.variants.ts`
- `routes/[dictionaryId]/history/sortedColumnStore.ts`
- `routes/[dictionaryId]/+layout.svelte`
- `routes/[dictionaryId]/+layout.ts`
- `routes/[dictionaryId]/settings/+page.ts`
- `routes/[dictionaryId]/settings/_page.variants.ts`
- `routes/+layout.ts`

All paths relative to `packages/site/src/`.

## Lint Errors Caused by Svelte 4 Patterns

These errors will resolve once the above files are migrated:

- **`ts/no-use-before-define`** (18 errors) - `$derived` referencing variables declared later, from `$:` conversion
- **`ts/no-unused-expressions`** (5 errors) - bare variable references for Svelte 5 reactivity tracking in `$effect`
- **`svelte/derived-has-same-inputs-outputs`** - store-derived naming mismatch

## Other Pre-existing Lint Errors to Fix

- **`style/max-statements-per-line`** (21 errors) - compound statements need splitting across multiple lines
- **`svelte/indent` + `style/indent-binary-ops`** (7 errors) - indentation fixes in IpaKeyboard, DictionaryPoints, OpenGraphImage
- **`style/no-tabs`** (5 errors) - Image2.svelte and component-to-png.ts
- **`ts/no-empty-function`** (5 errors) - empty stubs in checkForMissingKeysInHeaders.ts, CustomControl.svelte, admin +layout.ts
- **`require-await`** (2 errors) - RecordAudio.svelte, Image2.svelte
- **Misc** (1 each) - `regexp/no-unused-capturing-group`, `one-var`, `unicorn/no-new-array`, `node/prefer-global/buffer`, `array-callback-return`

## Cleanup

- [ ] Remove `.bak` files:
  - `routes/api/email/components/markdown/MarkdownToEmailHtml.bak`
  - `routes/api/email/components/markdown/RenderToken.bak`
