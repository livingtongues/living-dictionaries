# Dictionary /home entry-card redesign (richer data + ear button)

Jacob approved the mockup direction (2026-07-10 chat):

- **Unified layout for photo AND photo-less cards** — same DOM: dialect chip top,
  lexeme (2-line clamp) / alt orthography / [phonetic] at top; PoS (psAbbrev, periods)
  + up to 2 glosses at bottom; ear playback button (material-symbols/hearing, like
  homepage WordCards) bottom-right when audio. Photo cards keep the image behind a
  full scrim; photo-less get the hue gradient **softened to ~18/22% saturation**
  (`hsl(H 18% 36%) → hsl(H+40 22% 25%)`).
- Lexeme-only sparse card: centered, larger.
- Square 170px/140px size unchanged. Ear icon is NOT orange (that was mock emoji).
- Data borrowed from OG `seo_description.ts` hierarchy: local orthographies,
  phonetic, PoS, glosses, dialects.

## Plan
- ✅ `dict-home.ts`: add first-sense `parts_of_speech` + first `dialect` name subqueries
- ✅ `home-helpers.ts`: `top_glosses` (up to 2, gloss-language order)
- ✅ `+page.svelte`: HomeCard gains phonetic/alt/pos/glosses[]/dialect in both
  card_from_ssr + card_from_entry_data (live path: entry.main.phonetic,
  senses[0].parts_of_speech, dialects[0].name.default)
- ✅ `HomeEntryCard.svelte`: unified layout, ear button + playing state, soft gradient
- ✅ stories: data configs (photo full, no-photo full, alt+dialect, gloss-only no audio,
  long lexeme, sparse, manage)
- ✅ update `dict-home.test.ts`, run pnpm test + check + svelte-look screenshots

## Done 2026-07-10
All steps complete. Verified: dict-home + home-helpers vitest pass, `pnpm check`
0 errors, eslint 0 errors, svelte-look screenshots of all HomeEntryCard stories +
the /home page (light + dark, desktop + mobile) look right. Long single-word
lexemes needed `overflow-wrap: anywhere` to respect the 2-line clamp.

Note: two other agent sessions were active in this repo; a `git stash` from the
commit-gate session briefly swept dict-home.ts/home-helpers.ts edits, then
restored them.
