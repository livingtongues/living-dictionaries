# Corpus GA graduation + future milestones

Consolidated 2026-07-31 from `texts-sentences-pipeline.md` (M1–M6 ALL COMPLETE) and
`structured-grammar.md` (built + live) — full build records in git history. What remains is the
graduation decision and the future-milestone list.

## Graduate from admin-3 preview to GA (Jacob's call on timing)

- [ ] Lift the corpus preview gate (`$lib/corpus/corpus-preview-guard.ts`) — unified-search
      Words·Sentences·Texts scope chips, `/texts` browse + reader, sentence pages.
- [ ] Lift the grammar EDIT gate (`grammar_sections_editable`) from admin-3 to all managers
      (structural shape is proven; Ponca exercised it hard).
- [ ] Tappable/karaoke sentence render inside grammar sections lands when a corpus agent
      populates `sentences.tokens` + media `timings` for grammar-linked sentences.

## Future milestones (deliberately not scheduled)

- **Phrase-entry conversion** — detect multi-word entries (one dict has ~30K) and offer
  conversion to real sentences.
- **Server/LLM-assisted suggestion storage** (if matching goes beyond the local matcher).
- **Morphology matcher v2** — agglutinative languages; FLEx-style parses; inflected forms
  possibly via `entry_relationships` "form of" links.
- **FLEXtext interlinear import** — pre-analyzed corpora sidestep hard matching exactly where
  it's hardest. High-leverage.
- **Alternate-orthography tokenization**, `Intl.Segmenter` scripts, two-column/interleaved
  translation paste, sentence/text export surfaces, auto re-match on entry changes.
- **Entry auto-links beyond grammar** — the matcher + popover shipped on the grammar page
  (`grammar-polish-and-entry-links.md`, git history); the About page is the obvious next
  surface. Known v1 limits: phrase matching stops at element boundaries; section titles not
  scanned; no stored override lane yet (escape hatch would mirror `ignored_forms`).
