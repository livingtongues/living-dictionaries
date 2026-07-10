# Gallery cards restyled like dictionary-home featured cards + fullscreen viewer workover

Jacob's ask:
1. Gallery tab cards (`/[dict]/entries?view=gallery`, `GalleryEntry.svelte`) should look like the
   dictionary-home featured cards (`home/HomeEntryCard.svelte`): photo + scrim + dialect chip /
   lexeme / alt orthography / phonetic / pos / glosses overlay + in-place audio ear button.
   Only differences: gallery keeps its larger fluid grid size, and clicking opens the fullscreen
   image viewer (home cards navigate to the entry).
2. Q1 answer: entry navigation from gallery = the headword/title in the fullscreen viewer becomes
   a link to the entry. ALSO: give the fullscreen viewer (in `$lib/components/image/Image.svelte`)
   a design workover — it's bare-bones/unpleasing; add more info, improve design freely.
3. Q2 answer: rewrite GalleryEntry using Image.svelte as the photo layer (keeps fullscreen /
   spinner / AI badge / delete for free), layer home-card scrim/content/ear on top, copy CSS from
   HomeEntryCard. Leave HomeEntryCard alone (except audio-helper extraction if done).

## Plan
- ✅ Extract exclusive one-at-a-time card audio into `$lib/utils/exclusive-audio.svelte.ts`
  (module-level stop_current + per-card factory); use in HomeEntryCard + GalleryEntry.
- ✅ Rewrite `entries/gallery/GalleryEntry.svelte`: square fluid card, Image layer (square=480,
  page_context gallery), pointer-events-none scrim/content overlay (dialect, lexeme, alt,
  phonetic, pos, top_glosses), ear overlay-button (pointer-events auto). Derivations mirror
  `+page.svelte` `card_from_entry_data` (get_headword, get_local_orthographies, format_pos via
  psAbbrev + add_periods_and_comma_separate_parts_of_speech, top_glosses from home-helpers).
- ✅ Image.svelte viewer redesign: optional `href` (title→entry link) + `subtitle` props; nicer
  header/footer gradient bars, styled close, source/photographer caption in footer, AI chip,
  delete button restyle (btn classes), keep crossfade + Escape + click-to-close.
- ✅ Update GalleryEntry.stories.ts (rich entry: audio, dialect, phonetic, pos, alt) + CSR
  interaction story for the open viewer. Screenshot-verify light+dark via svelte-look.
- ✅ pnpm test / tsc / lint / check.

## Verification
- ✅ svelte-look: GalleryEntry stories (WithGloss / FullDetails / NoGloss / FullscreenViewer CSR)
  light+dark; HomeEntryCard stories unchanged after the audio-helper extraction.
- ✅ Headless e2e on real data (`/gta/entries` → gallery view → open viewer): no pageerrors,
  viewer title links to the entry.
- ✅ pnpm check (0 errors), tsc, vitest (1480 passed), lint.

## Lessons
- A `transform` on `:hover` of an ancestor makes it the containing block for a `position: fixed`
  descendant — the fullscreen viewer inside the gallery card got clipped to the card while
  hovered. Fixed with `.card:hover:has(:global(.thumb))` so the lift only applies while the
  thumbnail (not the viewer) is mounted.

## Notes
- Gallery grid stays `repeat(auto-fit, minmax(210px, 1fr))` in EntriesGallery.svelte.
- Image.svelte call sites: gallery, list/ListEntry, table/Cell, entry EntryMedia, contributors
  Partners — new props optional so all remain valid.
- ✅ Done. Also updated `.knowledge/` index? No — everything discoverable in code.
