# Drop uno-preflights.css from LD + house (converge on tutor's clean state) — ✅ DONE 2026-07-04

The `--un-*` universal initializer block (uno-preflights.css, identical in LD + house) existed only
to feed compiled sp-* styles in vendored legacy components. All dependent components rewritten to
plain scoped CSS with identical computed values; file deleted from both apps.

## Completed
- ✅ LD rewrites: ui/Slideover (clean, side classes; ✕ mask → `~icons/fa-solid/times`),
  ui/ResponsiveSlideover (semantic desktop/mobile + breakpoint classes; dead sp rules dropped),
  ui/JSON (+ house copy; code mask → `~icons/fa-solid/code`), ui/Badge (+static rgb colors),
  ui/BadgeArray + BadgeArrayEmit (plus mask → `~icons/fa-solid/plus`; `.badge-item` stays :global —
  passed as class prop into child Badge/Button), home/Search + SearchDictionaries (static shadow),
  image/ImageDropZone + audio/SelectAudio + video/SelectVideo (ring composition → static
  `0 0 0 3px rgb(134 239 172)`), components/Filter.svelte (removed DEAD `--un-ring-color` — nothing
  consumed it since the 07-02 skill-styled forms.css)
- ✅ house rewrites: ui/Modal (focus ring → `0 0 0 2px rgb(147 197 253 / 0.5)`; `.modal-footer`
  space-x calc resolved), ui/JSON
- ✅ Deleted `uno-preflights.css` + layout import + svelte-look `css_files` entry in BOTH apps
- ✅ Renamed `--un-default-border-color` → `--default-border-color` in LD + house + tutor
  (reset-tailwind.css + theme.css); deleted the dead `::before/::after { --un-content: '' }` block
  in all three
- ✅ AGENTS.md styling paragraphs updated (LD + house), house svelte-ui skill var name,
  LD ui-skill-alignment phase 4 + house post-parity issue marked done
- ✅ New stories: LD Badge/BadgeArray/BadgeArrayEmit/JSON/SelectAudio/SelectVideo/ImageDropZone,
  house JSON

## Verification (all in /tmp/unpre before|after at the time)
- svelte-look before/after pixel-diff: byte-IDENTICAL except icon-glyph antialiasing (mask →
  component swap) — note the old `mask-size:100% 100%` STRETCHED non-square FA viewBoxes to a
  square; iconify components render true aspect (imperceptible at 16px, arguably more correct)
- dev-server e2e before/after (LD nav slideover, user-menu slideover, home search modal; house
  LoginModal): only diffs were ≤1/255 shadow-gradient rounding (dropping the two zero-alpha
  ring/shadow layers changes Chrome's compositing rounding) + a Font-Awesome-KIT loading flake in
  a before shot (Header's `<i class="far fa-times">` Close — unrelated, still FA kit)
- `pnpm check`: house 0 errors; LD 0 errors in my files (6 pre-existing errors belong to another
  agent's in-flight GCS/analytics work — upload-image.ts, insights.test.ts). eslint clean.

## Leftovers / follow-ups
- LD `ui/Button.svelte` + house `[documentId]/edit/+page@.svelte` still carry self-contained sp-*
  compiled styles (no `--un-` deps) — retirement plan: `.issues/button-retirement.md`
- house Button.svelte comment still mentions the old chain historically (accurate, kept)
