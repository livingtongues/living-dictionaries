# Glossing abbreviations — a site-wide floor under every dictionary's legend

Interlinear glosses, entry `morphology`, and grammar prose are all full of codes (`1SG`, `PST`,
`2SG.OBJ`). Until 2026-07-29 only a dictionary's own `glossing_abbreviations` rows could explain
one, so a dictionary whose team never wrote a legend showed opaque strings. Jacob's mandate for
round 2b: **first-class morphology treatment — codes must be understandable everywhere, with
i18n-translatable expansions, site-wide, not Ponca-only.**

## The layering rule

`$lib/mappings/glossing-abbreviations.ts` holds the standard Leipzig catalog (the appendix + the
nine person·number portmanteaux + a short tail of near-universal extensions). It is the FLOOR:
`$lib/corpus/gloss-catalog.ts` merges it under the dictionary's own rows, and **a dictionary row
always wins on a collision** — its wording is about that language.

Two things deliberately did NOT happen:
- **Standard codes are never poured into a dictionary's legend section.** `GlossingLegend`
  still renders the dict's curated rows and nothing else (Jacob: "don't dump standard codes into
  dict legends"). A "curated vs standard" marker would also be meaningless there, since every row
  it lists is curated by definition. Discovery of a standard code happens where the code is —
  tap it.
- **Person·number combos are catalogued whole** (`1SG` = "first person singular") rather than
  composed from `1` + `SG` at render time. Word order and agreement are a translator's call, not
  string concatenation's. Dot-composites the catalog doesn't own (`PST.PRF.1SG` in a dict with only
  the parts) ARE composed, joined with ` · ` — a last resort, not the design.

## Three matching modes, because a code is not equally trustworthy everywhere

| Surface | Splitter | Rule |
|---|---|---|
| interlinear gloss cell | `split_gloss_cell` | curated codes match ANYWHERE (substring — the promise the schema + corpus guide make); standard codes need token boundaries, but even `A`/`S`/`P` count — a gloss cell is analysis by definition |
| free-text field (entry `morphology`) | `split_field` | as above, minus one-character standard codes: plenty of dictionaries write sentences in these fields, and "A" is an English word first |
| authored prose (grammar sections) | `split_prose` | token boundaries for EVERYTHING including curated codes, and ambiguous codes (single character, or no upper-case letter) dropped entirely |

The boundary is unicode-aware (`\p{L}\p{N}\p{M}`) — without `\p{M}` a combining diacritic makes
`PL` fire inside a vernacular form like `PLđihą́`.

Proof the prose filter earns its keep: Ponca's 77KB grammar contains **zero** Leipzig codes in its
prose, but plenty of standalone `I`, `A`, `B`, `3`, `100` — every one of which a naive matcher
would have small-capped, and none of which do. Ponca's own legend even registers `3` and `Ø`.

## The DOM pass has to be undoable

`link_gloss_codes` is modelled on `link_entry_mentions` (TreeWalker over `{@html}` output, rAF
deferred for the hydration race, buttons carry the data, the host owns the popover) with ONE extra
rule: **its cleanup restores the original text nodes.** The entry-link pass can skip that because
its index is null until it's complete; the gloss catalog is never null — the standard set is usable
immediately and the dictionary's legend streams in a moment later, re-running the attachment. A
re-run walks TEXT nodes, so anything still wrapped in a button would keep its first, half-informed
expansion (observed live: `PST.PRF.1SG` stuck on the composed "past · perfect · first person
singular" instead of Ponca's curated "past perfect, first person singular (mikè)").

## i18n

The catalog's `enName`s are mirrored into the `gloss.*` section of `en.json` (a vitest keeps the two
in lockstep), so translators localise them at `/translate` like any other UI string and the
Dockerfile bake carries them. Unknown codes are NEVER looked up through `t()` — a bespoke code is
dictionary data, not a missing UI string, and would otherwise be reported as a translation gap.

## Where a person/number/tense label belongs: `morphology`, not `parts_of_speech`

Printed dictionaries cram inflection into the POS slot ("*v., 1st pers. sing., past t.*") because a
book has one italic slot per headword. LD has two fields, and the 2026-07-29 Ponca cleanup set the
precedent for every book import that follows:

- **`senses.parts_of_speech` keeps only real categories.** A label that is person, number or tense
  is not a part of speech, even when it is technically on the official list — `pl` was moved out for
  exactly that reason, so a dictionary doesn't end up marking plurality two ways.
- **`entries.morphology` takes the inflection, as glossing codes**, composed **person/number first,
  then tense** (`1PL.PST`, `3SG.PRS/PST`). The opposite order that shows up inside some legends
  (`PST.PRF.1SG`) describes a single morpheme of that language; our composed descriptor is a
  different thing and doesn't have to match it.
- **Anything with no standard equivalent gets written out in full** (`prepositional phrase`) rather
  than kept as a private abbreviation. Unknown POS values render verbatim, so a dropped abbreviation
  key costs the reader nothing.
- The seam is lossy in one place worth stating up front: `morphology` is **entry-level** while the
  labels are **sense-level**. Jacob's call was to accept the mild over-claim on the handful of
  entries where one sense is inflected and a sibling isn't, rather than leave those entries
  un-migrated.

Worked example, with the full before/after table and the runbook:
`.issues/ponca-pos-report.md` + `scripts/ponca/pos-migration.cjs`.
