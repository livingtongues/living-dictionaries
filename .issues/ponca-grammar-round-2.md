# Ponca grammar round 2 — clause strip placement, section re-partition, POS standardization, TOC deep links

From Jacob's 2026-07-29 review of https://livingdictionaries.app/ponca/grammar. All decisions
below are Jacob-approved. Coordinator session farms the work to three lanes (opus 5, key=work).

## Decisions (Jacob, 2026-07-29)

1. **Clause template strip** currently renders pinned ABOVE the whole section tree whenever a
   dict has `clause_slots` rows (Ponca's were agent-created 2026-07-28), which interrupts the
   dictionary's untitled intro essay. → **Collapse to a TOC entry that jumps to the strip
   rendered at the BOTTOM near the glossing legend.**
2. **Subsection flattening**: the import concatenated all of a parent's interleaved prose into
   its body and pushed tables into child sections, so lead-in sentences ("as given here:") no
   longer sit next to their tables. → **Re-partition content, model unchanged**: each table
   subsection absorbs its lead-in prose + follow-up commentary; parent keeps only the true
   intro. **Audit ALL 11 parents with children** against the PDF.
3. **Grammar "Parts of Speech" section** (`5bffc336`): drop the table entirely; keep the intro
   prose ("the verb is at the heart of the language…"). Customs map to standard site POS where
   possible; anything else written out in full (bespoke POS render verbatim — confirmed:
   `translate_part_of_speech` falls back to raw string).
4. **Sense POS cleanup** (prod, 48 distinct values): (a) merge typo variants (apply directly);
   (b) map customs→standard where a true equivalent exists — dry-run report for Jacob FIRST;
   (c) person/tense pseudo-POS (~97 senses, e.g. `["v","1st pers. sing."]`, all with EMPTY
   morphology) → move to `entries.morphology` as **Leipzig glossing codes** (`1SG`,
   `1PL.PST`) consistent with the dict's `glossing_abbreviations` legend; report first.
5. **Morphology code rendering**: reuse `build_gloss_splitter` (`$lib/corpus/gloss-legend.ts`)
   so legend codes in morphology display small-caps + tap-to-expand, like `InterlinearGloss`.
6. **Grammar TOC**: rail heading says "Grammar" not "Contents"; clicking a TOC entry must
   UPDATE THE URL HASH (deep-linkable), and loading a URL with a hash scrolls there.

## Key facts for lanes

- Ponca import workspace with the PDF lives at `~/import-work/ponca/` on mustang (`raw.pdf`,
  `full.txt`, `pages/`, `grammar-blocks.md`, `grammar-sections.json`,
  `glossing-abbreviations.json`, `clause-slots.json`).
- Prod access: `ssh living 'docker exec -i sveltekit_blue node' < script.js` (better-sqlite3,
  `/data/dictionaries/ponca.db`); see database skill "Querying / modifying the production VPS
  DBs". Writes go through the v1 API with a scoped attributed key + R2 backup first — follow
  the de-CAPS runbook precedent in `.issues/grammar-polish-and-entry-links.md` ("Ponca caps
  rewrite") and `scripts/ponca/decaps-grammar.cjs`.
- Per-dict writes propagate to browsers via the R2 snapshot (~30 min), not live sync.
- 11 parents with children (prod ids): 986477d1, e30492c7, 759d0367, 04455415, f62c1a47,
  8acaaeba, 13f97ae7, ea1aca92, c59a4322, e233d9d5 (+ intro-less parents — re-derive the list).
- Glossing legend = dict.db `glossing_abbreviations` (65 Leipzig-style rows, agent-curated);
  renderer `$lib/corpus/GlossingLegend.svelte`; splitter + tap-to-expand pattern in
  `$lib/corpus/gloss-legend.ts` + `InterlinearGloss.svelte`.
- Standard POS list: `site/src/lib/mappings/parts-of-speech.ts` (~95 official). Bespoke POS
  display raw everywhere.

## Lanes

### Lane 1 — code (site) — ✅ DONE 2026-07-29 (working tree, NOT committed)
- [x] ✅ Move ClauseTemplateStrip render to the bottom of GrammarSectionsView-area, adjacent to
      GlossingLegend; TOC pinned entry for it moves next to the legend entry; scroll-spy anchors
      keep working.
- [x] ✅ TOC rail heading `grammar.contents` → use the "Grammar" label (`dictionary.grammar`);
      check GrammarTocBar (mobile) for the same.
- [x] ✅ TOC deep links: click updates `location.hash` (history API, no SvelteKit nav re-run,
      keep smooth scroll + on_navigate close behavior); on first load with a hash, scroll to
      that anchor once sections render (dict_db loads async — wait for rows).
- [x] ✅ Morphology glossing-code rendering: wherever entry `morphology` displays, split with
      `build_gloss_splitter` over the dict's `glossing_abbreviations`; matched codes small-caps
      + tap-to-expand (reuse InterlinearGloss pieces/popover). No-op for dicts with no legend.
- [x] ✅ Verify: svelte-look stories (grammar page incl. strip-at-bottom, TOC, morphology codes),
      vitest, tsc, lint, pnpm check — plus a real-data puppeteer pass on local `/ponca`.

#### What changed (Lane 1)
- `grammar/+page.svelte` owns BOTH bottom landmarks now: `ClauseTemplateStrip` (new
  `.clause-anchor`, `margin-top: 1.5rem`) then `GlossingLegend`. Rail heading = `dictionary.grammar`.
  A new one-shot `$effect` lands an incoming URL hash once the sections exist.
- `GrammarSectionsView.svelte`: strip + `CLAUSE_TEMPLATE_ANCHOR` + the `has_clause_slots` prop
  removed. The edit-mode "Edit clause slots" button / `ClauseSlotManager` deliberately STAYED at the
  top — it is the only way to create a first slot, and burying it under 77KB of prose hides it.
- `grammar-toc.ts`: the clause-template pinned entry moved from first to just above the legend entry
  (test now asserts the whole order).
- `scroll-spy.svelte.ts`: `scroll_to_anchor({ dom_id, smooth })` (options object) and it RETURNS
  whether the element existed — that return is what makes the deep-link retry work.
- `GrammarToc.svelte`: a click writes the hash via `replaceState` from `$app/navigation`.
- NEW `$lib/corpus/GlossedText.svelte` (+ stories): legend-aware plain-text renderer, extracted from
  `InterlinearGloss`'s code button + popover. Wired into `EntryField` (`field === 'morphology'`) and
  the entries-table `Textbox` through a new `gloss_codes` prop set in `Cell.svelte` (+ new
  `Textbox.stories.ts`).
- `grammar.contents` deleted from `en.json` (no other locale had it translated).

#### Lessons / gotchas (Lane 1)
- **`replaceState`, not `pushState`**: a TOC gets clicked many times per read, and 20 hash entries
  make Back useless. It is wrapped in try/catch because svelte-look mounts components WITHOUT a
  SvelteKit router and `$app/navigation`'s `replaceState` throws there (svelte-look shims
  `$app/state` only). Native `history.replaceState` was rejected — SvelteKit dev-warns on it.
- **Deep-link timing**: the browser's own hash scroll fires long before the dict DB streams sections
  in, so the hash must be re-applied. The effect reads `loading` AND `rows` unconditionally so it
  re-runs when rows arrive, and uses `smooth: false` (a page-load jump shouldn't animate).
- `svelte/indent` errors on a comment-only `catch {}` body — put the comment on the `catch` line.
- `GlossedText`'s code button calls `stopPropagation()`: both host fields are click-to-edit, so
  without it tapping a code also opened the edit modal behind the popover.
- Print (`PrintEntry.svelte`) left as plain text on purpose — a popover means nothing on paper.
- Verified on local prod-shaped Ponca data (puppeteer, `/ponca/grammar`): rail says "Grammar", the
  two landmarks are last in DOM and TOC, a TOC click writes `#section-<id>` and scrolls, and a cold
  load of that URL parks the section at its 4rem scroll-margin line. Morphology round-tripped by
  typing `1SG-đihą́-2SG.OBJ` into an entry (small-caps + popover confirmed; value cleared after).
- Mobile: the sticky TOC bar's no-breadcrumb fallback now reads "Grammar", which duplicates the h3
  directly above it at the very top of the page (it turns into the section name as soon as you
  scroll). Say the word if you'd rather it read something else when idle.

### Lane 2 — Ponca re-partition (prod content) — ✅ DONE 2026-07-29
- [x] For every parent with children: reconstruct the PDF reading order from
      `~/import-work/ponca/` artifacts; move lead-in/commentary prose from parent body into the
      owning subsection bodies (prose may precede AND follow a table inside a subsection body).
      Parent keeps only prose that genuinely precedes the first subsection.
- [x] HARD INVARIANT: no prose created, deleted, or reworded — text only re-homed; verify by
      normalized-concatenation comparison before/after per chapter.
- [x] R2 backup + scoped attributed API key (label it), PATCH via v1 grammar API, read-back
      verify, history-db attribution check, revoke key. Eyeball rendered prod page (human UA).

See **"Lane 2 execution log"** at the bottom for method, decisions, verification and residuals.

### Lane 3 — POS standardization (report first, partial apply)
- ✅ Apply directly (with backup + key): typo-variant merges — `past. t.`→`past t.`,
      `prep phr.`→`prep. phr.`, `3rd pers sing.`→`3rd pers. sing.`, `s./pl.`→`sing./pl.`.
      Exactly 4 senses; all 4 PATCHed via v1 on 2026-07-29. Backup
      `r2/backups-rolling/db/living/2026-07-29T02-06-44Z.tar.zst`; key
      `8f723026-3383-4772-ad2b-eabbf032253a` ("Ponca POS typo merge 2026-07-29",
      Jacob-attributed) revoked `2026-07-29T02:12:33.389Z`. Read-back: 0 typo values remain,
      distinct POS values 48→44; `ponca.history.db` holds exactly 4 `senses` update rows for
      that key with deltas confined to `parts_of_speech`; both DBs `integrity_check` ok.
      Script: `scripts/ponca/pos-typo-merge.cjs` (`--dry` / `--apply --key=` / `--verify`).
- ✅ DRY-RUN REPORT → `.issues/ponca-pos-report.md`:
      - each remaining custom vs the standard list — proposed mapping or "write out in full";
      - person/tense→morphology plan: per-entry proposed Leipzig code string (from the dict's
        legend codes; list any code that would need adding to `glossing_abbreviations`), which
        real POS remains (add `v` where the only POS was a person label — list for eyeball);
      - proposed replacement body for the "Parts of Speech" grammar section (intro prose kept,
        table dropped; note whether any usage labels like archaic/slang/lit. still earn a spot).
- ✅ STOPPED after the report — 8 decisions listed in its part 5 await Jacob before any apply.

## Status
- ✅ Lane 1 spawned: 2d4d933a — code complete, uncommitted
- ✅ Lane 2 spawned: 54d0e5e5
- ✅ Lane 3 spawned: c37169a3

## Round 2b (2026-07-29, Jacob's follow-up) — three more lanes

Jacob's decisions: residual tables → promote to subsections (titles from caption lines); keep the
new explanatory paragraph in the POS section; mobile TOC idle label = "Contents" (desktop rail
stays "Grammar"), and clicking either heading scrolls to the very top + clears the URL hash.
On the POS report's part-5 decisions Jacob delegated: apply ALL report recommendations —
2a straight remaps · `pl`→morphology `PL` · `pl. pron.`→`pro`+`PL` · `pl./emphatic`→`poss`+`PL.EMPH`
· `past part.`→keep `v`+`PST.PTCP` · order `1PL.PST` (person first) · add legend codes `1`+`2` ·
Wéšną→`adj` · accept the 2-entry over-claim (3f option a).

Jacob's overarching mandate: **first-class morphology treatment, no lazy solutions** — codes must
be understandable everywhere (grammar + entry views), with i18n-translatable expansions; site-wide,
not Ponca-only.

### Lane 4 — code (site): morphology first-class + TOC polish — ✅ DONE 2026-07-29 (uncommitted)
- [x] ✅ Site-wide standard glossing catalog: `$lib/mappings/glossing-abbreviations.ts` with the
      standard Leipzig abbreviation list (code + EN name), EN i18n keys (pattern like `ps.*`,
      e.g. `gloss.*`) so translators can localize expansions. Dict `glossing_abbreviations`
      rows OVERRIDE the standard catalog on collision; merged set feeds GlossedText so ANY
      dictionary's morphology codes expand on tap, even with no hand-curated legend.
- [x] ✅ Grammar prose code expansion: legend/standard codes inside rendered grammar section
      bodies get the same small-caps + tap-to-expand. MUST be token-boundary matched
      (standalone tokens bounded by non-alphanumerics, case-sensitive) — the substring
      matcher is only safe inside gloss cells, prose needs boundaries. DOM-attachment
      pattern precedent: `$lib/entry-links/link-entry-mentions.ts` (incl. the rAF-defer gotcha).
- [x] ✅ GlossingLegend: **no change** — a curated/standard marker would be meaningless there
      (every row it lists is curated by definition) and adding the standard set is the dump
      Jacob ruled out. Dict rows remain the section's only content source.
- [x] ✅ Mobile GrammarTocBar idle label → "Contents" (re-add key); desktop rail heading stays
      "Grammar". Clicking either heading scrolls to top (smooth) AND clears the hash.
- [x] ✅ Verify: stories, vitest (2371 pass), check (0 errors), lint clean, plus a real-data
      puppeteer pass on local `/ponca/grammar`.

#### What changed (Lane 4)
- NEW `$lib/mappings/glossing-abbreviations.ts` — 111 standard codes (Leipzig appendix + the nine
  person·number portmanteaux + ~19 near-universal extensions), each with an `enName`. A vitest
  keeps it 1:1 with the new `gloss.*` section of `en.json` (generated from the list, so no typos);
  `/translate` + the deploy bake pick the section up with no extra wiring. Also added
  `grammar.contents` + `grammar.back_to_top`.
- NEW `$lib/corpus/gloss-catalog.ts` — `build_gloss_catalog({ legend, language, t })` layers the
  dict's rows OVER the standard catalog and exposes `expand` (incl. dot-composites joined with
  ` · `) plus three splitters: `split_gloss_cell` (IGT), `split_field`
  (morphology/interlinearization), `split_prose` (grammar bodies). Tests in `gloss-catalog.test.ts`.
- `gloss-legend.ts` gains `build_token_gloss_splitter({ codes })` — unicode-aware boundary matching
  (`\p{L}\p{N}\p{M}`) with whole-composite matching. The old substring `build_gloss_splitter` is
  untouched, so curated gloss-cell behaviour is exactly what it was.
- NEW `$lib/corpus/link-gloss-codes.ts` (DOM attachment, twin of `link_entry_mentions`) +
  `gloss-code-context.ts`; wired into `GrammarSection` as a second `{@attach}` on each prose body
  (with `:global(.gloss-code)` styles), catalog + popover owned by `grammar/+page.svelte`.
- NEW `$lib/corpus/GlossCodePopover.svelte` — the expansion card, now shared by `GlossedText`,
  `InterlinearGloss` (both lost their duplicated copy) and the grammar page.
- `GlossedText` + `InterlinearGloss` run off the catalog now; `EntryField` and the entries-table
  `Cell` extend gloss rendering to `interlinearization` as well as `morphology`.
- NEW `grammar/grammar-hash.ts` owns `write_section_hash` (moved out of `GrammarToc`) +
  `clear_section_hash`; `scroll-spy.svelte.ts` gains `scroll_to_top`. The page `h3` and the rail
  heading are buttons → smooth scroll to top + hash cleared. Mobile bar idle label = "Contents".
- Stories: `_page.stories.ts` gains `ProseGlossCodes`, `ProseGlossCodeExpanded`, `BookMobileIdle`,
  `BookDesktopBackToTop`; `GlossedText.stories.ts` gains `AmbiguousCodesLeftAlone` (and `NoLegend`
  now demonstrates the standard floor).

#### Lessons / gotchas (Lane 4)
- **The prose DOM pass MUST undo itself on teardown.** The entry-link pass gets away without that
  because its index is null until complete; the gloss catalog is never null — the standard set is
  usable on the first frame and the dict legend streams in later, re-running the attachment. A
  re-run walks TEXT nodes, so a code already wrapped in a button keeps its first, half-informed
  expansion. Caught live on Ponca: `PST.PRF.1SG` was stuck on the composed "past · perfect · first
  person singular" instead of the curated "past perfect, first person singular (mikè)". Cleanup now
  replaces each button with its text node and `normalize()`s the parent.
- **Single-character and lower-case codes are poison in prose.** Ponca's legend registers `3` and
  `Ø`; its prose has 89 standalone "I", 15 "A", and every numeral. `is_ambiguous_in_prose` drops
  anything under 2 characters or with no upper-case letter — measured result on the real 77KB
  grammar: 0 matches, which is CORRECT (that book spells its categories out in words).
- **`\p{M}` in the boundary class is not optional** — without combining marks `PL` fires inside
  `PLđihą́`. Lookbehind was avoided entirely (Safari <16.4): the scanner checks the preceding
  character in JS and bumps `lastIndex` by one on rejection.
- **Person·number combos are catalogued whole** (`1SG` = "first person singular"), never composed
  from `1` + `SG` — word order/agreement is a translator's call. Composites the catalog doesn't own
  are still assembled (` · `) as a last resort.
- **Never `t()` an unknown code**: `gloss.*` is only looked up for codes the standard catalog owns,
  or every bespoke dictionary code would be logged as a missing translation key.
- Real-data verification recipe (local dev has a prod-shaped `.data/dictionaries/ponca.db`): the
  headless browser boots the dict DB from the local VPS path as admin-3, so temporarily patching one
  `grammar_sections.body` with a code-bearing paragraph (then restoring it byte-identically) is the
  cheapest end-to-end proof — 3 codes decorated, 513 entry mentions untouched, 0 nesting collisions,
  0 console errors, TOC deep link + back-to-top (hash cleared, scrollY 0) confirmed. Files in
  `/tmp/lane4/`.
- Knowledge: new `.knowledge/domain/glossing-abbreviations.md`; the two-headings/"Contents" rule
  appended to `.knowledge/domain/grammar-page-navigation.md`.

### Lane 5 — prod: POS migration apply (per report + decisions above) — ✅ DONE 2026-07-29
- [x] ✅ Backup + scoped attributed key (label it), then via v1 API:
      senses `parts_of_speech` remaps (report 2a/2b/2c incl. Wéšną→`adj`, wíwítʼa→`poss`),
      entry `morphology` fills (report 3g plan, order person-first), legend inserts `1`+`2`,
      POS section body replacement (report part 4 draft, keep new paragraph).
      Backup `r2/backups-rolling/db/living/2026-07-29T05-11-42Z.tar.zst`; key
      `416499f8-1530-4923-aaf0-59339b0ae66b` ("Ponca POS migration 2026-07-29",
      Jacob-attributed); 121/121 entry PATCHes + 2 legend POSTs + 1 section PATCH, all 200.
      Script `scripts/ponca/pos-migration.cjs` (`--dry` / `--dry --json` / `--apply --key=` /
      `--verify`) re-derives the plan from prod rather than transcribing the report, and was
      cross-checked against the 3g table (108/110 identical; the 2 diffs are exactly Jacob's
      Wéšną→`adj` and wíwítʼa→`poss` overrides).
- [x] ✅ Read-back verify + history attribution + revoke key + rendered-page eyeball.
      0 pseudo-POS values left, distinct POS 44→23, 105 entries carry morphology, legend
      `1`+`2` live, POS section 1,045 chars with the 37-row key gone; `ponca.history.db` holds
      exactly 234 rows for the key (105 entries / 126 senses / 2 legend / 1 section, deltas
      confined to `morphology` / `parts_of_speech` / `body`, single user_id = Jacob); both DBs
      `integrity_check` ok; key revoked `2026-07-29T05:23:40.903Z` (a write with it now 401s).
      Live pages checked after the 05:44Z snapshot sweep: §2 "Parts of Speech" renders the kept
      intro + the new paragraph + 10 usage labels, the legend shows `1`/`2` under PERSON AND
      NUMBER, and Ąʼwą́đataì shows POS "verb" + morphology `1PL.PST` as tap-to-expand codes
      (screenshots in `/tmp/ponca-lane5/`). Reminder: drive prod with a real desktop UA — a
      `HeadlessChrome` UA hits the bot gate and dictionary pages stay empty forever.
- [x] ✅ Update `.issues/ponca-pos-report.md` marking applied — its **part 6** is the apply log.

### Lane 6 — prod: residual subsection promotion (5 chapters) — ✅ DONE 2026-07-29
- [x] ✅ Per Lane 2's residuals list (§7 Š- Íʼbahą̀ · §8 B-/Na- Mąđí · §9 summary chart ·
      §10 five instrumental-prefix tables · §11 cause/negation): create subsections titled
      from each table's existing bold caption line, move the table + its lead-in/follow-up
      prose in, preserving PDF order; parent keeps only what precedes its first child.
      Same no-reword invariant (titles may be extracted from existing caption text).
- [x] ✅ Same backup/key/verify runbook; extend `scripts/ponca/repartition-grammar.py` or add a
      sibling script; verify all 10 chapters now match PDF block order.

See **"Lane 6 execution log"** at the bottom.

### Round 2b status
- ✅ Lane 4 spawned: a0810a61
- ✅ Lane 5 spawned: 974569d8
- ✅ Lane 6 spawned: 0a4956cb

## Lane 2 execution log (2026-07-29, session 54d0e5e5) — APPLIED TO PRODUCTION

### Scope re-derived
Prod has **10** parents with children (the issue said "11"; the listed 10 ids were right):
`986477d1 e30492c7 759d0367 04455415 f62c1a47 8acaaeba 13f97ae7 ea1aca92 c59a4322 e233d9d5`.

### Method
1. `~/import-work/ponca/grammar-blocks.md` is the PDF reading order (headings, `**CAPTION**`
   + `<!-- table -->` groups, paragraphs). Parsed it into per-chapter block sequences.
   **Text came from PROD, never from the blocks file** — prod carries the de-CAPS + round-4 +
   italics fixes; the blocks file supplied ORDER only.
2. Proved the import's split was mechanical: for all 10 chapters the parent body's blocks are
   EXACTLY the chapter's non-captioned blocks in order, and each child body is EXACTLY the
   n-th captioned table (normalized compare — 10/10 parents, 39/39 children matched).
3. Assigned every parent paragraph to `parent` / `child n before table` / `child n after table`
   by hand, then rebuilt the bodies (blocks joined with a blank line).

### Assignment rules used
- **Back-reference opener → `after` the previous child's table; forward/fresh opener → `before`
  the next child's table.** (For a bridge paragraph both render identically; the rule only
  decides which heading it falls under.)
- **Prose before the first captioned table stays in the parent** — it is the chapter intro and
  already renders immediately above child 1.
- **Prose that owns a plain (uncaptioned) table stays in the parent with it.** Plain tables were
  never moved… except:
- **Three empty stub subsections were filled** with the parent-body material their titles name
  exactly (prose *and* its plain tables). They were body-less placeholders holding only example
  sentences: `cfcf7220` "The verb -ną́ʼą ‘to hear (something)’" (4 paras + 4 tables from
  f62c1a47), `8c418763` "The suffix -tigđè" and `6ba79576` "The particles gá and á" (1 para +
  1 table each, from 13f97ae7). This is the only place a table changed section.

### Result
**38 sections PATCHed** (10 parents… 9 changed + 29 children; `e233d9d5` needed no change).
Renderer is `parent body → usage → examples → children`, so a chapter can only be in perfect PDF
order when every one of its tables is a child. That now holds for 5 chapters
(`986477d1 e30492c7 ea1aca92 c59a4322 e233d9d5` — verified block-for-block against the PDF).

### Verification
- Invariants (before vs after, whole dictionary, all 59 sections): prose blocks **101 → 101**,
  table blocks **73 → 73**, both **identical multisets of exact strings** — nothing created,
  deleted or reworded. Counts equal the PDF's own 101 paragraphs / 73 tables.
- Titles unchanged, section count 59, every `parent_id` + `sort_key` unchanged.
- Read-back from prod: **49/49 bodies byte-identical to the plan**.
- Backup BEFORE the write (online-backup API, `integrity_check: ok`, 59 sections):
  `r2/backups-rolling/db/living/ponca-pre-repartition-2026-07-29T02-15-59Z.db.zst`
  (also kept at `~/import-work/ponca/ponca-pre-repartition-2026-07-29T02-15-59Z.db.zst`).
- Key: `d1d9cbc0-3c27-4699-94ad-e8cb346fbba9`, label "Ponca grammar section re-partition
  2026-07-29", attributed to jacob@livingtongues.org, minted 02:17:21Z, **revoked 02:20:27Z**
  (0 active ponca keys remain).
- History db: exactly **38 `changes` rows, 38 distinct row_ids, op=update, all with that
  api_key_id and user_id=de2d3715…**; no other key wrote in the window.
  `ponca.db` + `ponca.history.db` `integrity_check: ok`; 0 `dirty` rows.
- Rendered prod (headless Chrome, human UA, after the 02:32Z snapshot rebuild): 59 sections,
  **zero page errors**, structure dumped block-by-block and matches the plan exactly.
  Screenshots: `/tmp/ponca-lane2/shot-{basic,suffixes,tense}.png`,
  full page `/tmp/ponca-lane2/prod-grammar-full.png`; working files in `/tmp/ponca-lane2/`.
- Tooling kept in the repo: **`scripts/ponca/repartition-grammar.py`** (stdlib only;
  `--plan` / `--verify` / `--apply --key=`). It reproduces the applied plan byte-for-byte, and
  **refuses to run again** once prod no longer matches the PDF block sequence — so a careless
  re-run cannot double-move prose.

### Residual imperfections (NOT regressions — all pre-existed; need a model change to fix)
Because the parent body always renders above its children, parent-retained plain tables now sit
*before* the subsections rather than in PDF position:
- §7 Š-: the `Íʼbahą̀ ‘to know’` para + table renders right after the chapter intro.
- §8 B-/Na-: the `Mąđí ‘to walk’` para + table + follow-up likewise.
- §9 Both subj/obj: the "basic system of conjugation is now apparent" summary + full Đihą́ chart
  renders before the six Đihą́ paradigms (it summarizes them).
- §10 Verb Prefixes: the five instrumental/adverbial-prefix tables stay in the parent, so §10.1
  (`Sé ‘to cut’`) still renders after them — its lead-in is the chapter intro and had to stay.
- §11 Verbal Suffixes: the cause/negation para + table sits between the intro (which ends
  "…the particle **čábe**…as illustrated below:") and §11.1 čábe.
Fixing any of these would mean inventing new subsections (titles = new content), which is out of
"model unchanged" scope. Flagging for Jacob: say the word and each can become its own subsection.

**→ Jacob said the word. All five are fixed by Lane 6 below.**

## Lane 6 execution log (2026-07-29, session 0a4956cb) — APPLIED TO PRODUCTION

### What was done
**9 new subsections created**, and the 5 residual chapters' parents trimmed to just the prose that
truly precedes their first child. Prod `grammar_sections` **59 → 68**.

| chapter | new subsection (title) | content moved | placed after |
| --- | --- | --- | --- |
| §7 `759d0367` | `Íʼbahą̀ ‘to know’` | para + table | `19d11ce5` (last child) |
| §8 `04455415` | `Mąđí ‘to walk’` | para + table + follow-up para | `519a6a6f` (last child) |
| §9 `f62c1a47` | `Full system of conjugations—Đihą́ ‘to lift’` | para + full chart | `a1302362`, before `cfcf7220` |
| §10 `8acaaeba` | `Instrumental prefixes` | para + table | `bc9bb13d` (§10.1 Sé) |
| §10 | `Xíáđa ‘to fall’` | para + table | previous |
| §10 | `The adverbial prefix Áʼ-` | para + table | previous |
| §10 | `The adverbial prefix Íʼ-` | para + table | previous |
| §10 | `The adverbial prefix Úʼ-` | para + table | previous |
| §11 `13f97ae7` | `Verb-final grammatical markers: cause or negation` | para + table | `8c418763`, before `6ba79576` |

### Titles — where each came from
Jacob's rule was "titles from each table's existing bold caption line", but these 9 tables are
exactly the ones the PDF prints with NO caption (that's why the import never made them children).
So every title is **lifted verbatim from the section's own moved content**, in the naming style its
siblings already use, and the script asserts it (`fragments`, normalized substring test — a title
fragment that isn't present in the body fails `--verify`):
- `Íʼbahą̀ ‘to know’`, `Xíáđa ‘to fall’`, `Instrumental prefixes`, and the three
  `The adverbial prefix …` titles are contiguous substrings of their own lead-in prose.
- Two are assembled from two verbatim fragments each: `Mąđí ‘to walk’` (table row
  `| **Mąđí** | to walk |`, matching sibling `Đate ‘to eat something’`) and
  `Full system of conjugations—Đihą́ ‘to lift’` ("the full system of **conjugations**" +
  "**Đihą́** ‘to lift’", matching sibling `Third person plural subject paradigm—Đihą́ ‘to lift’`).
- `Verb-final grammatical markers: cause or negation` joins two verbatim fragments of its lead-in.

### Verification
- **PDF block order: 10/10 chapters ✅** (before: 5 ✅ / 5 ❌ — the checker reproduces Lane 2's exact
  residual list, then passes on the post-apply prod dump). This is an INDEPENDENT check
  (`--order`): it re-parses `grammar-blocks.md`, walks the prod tree depth-first in render order
  (parent body → children) and compares the normalized block sequence.
- **No-reword invariant, per chapter (pre vs post prod dumps, parent + all descendants):** identical
  multisets of exact block strings — §7 7 paras/5 tables, §8 6/5, §9 22/13, §10 7/7, §11 4/4,
  all unchanged. Scoped per chapter (not dictionary-wide) on purpose: Lane 5 was writing the POS
  section concurrently.
- Read-back: the 9 new rows are **byte-identical to the plan** (title, body, parent), the 5 trimmed
  parent bodies too; the ONLY pre-existing rows that changed are those 5 parents; **zero drift** in
  any existing title / `parent_id` / `sort_key`; 0 rows deleted.
- Sort keys landed exactly as the local simulation predicted (`z`, `z`, `zn`, `n`, `p`, `q`, `qi`,
  `qr`, `u`) — the API's `after_section_id` fractional indexing, no neighbour rewrites.
- Backup BEFORE the write (online-backup API, `integrity_check: ok`, 59 sections, 5257 entries):
  `r2/backups-rolling/db/living/ponca-pre-subsection-promotion-2026-07-29T05-14-18Z.db.zst`
  (also at `~/import-work/ponca/`).
- Key: `f0cd7eb3-58e0-4569-a6b2-7ef1fd4121ef`, label "Ponca grammar residual subsection promotion
  2026-07-29", attributed to jacob@livingtongues.org, minted 05:14:52Z, **revoked 05:16:22Z**
  (0 active ponca keys remain; a post-revoke PATCH probe returns 401).
- History db: exactly **14 rows for that key — 9 `grammar_sections` inserts + 5 updates**, 14
  distinct row_ids, user `de2d3715…`, update deltas confined to `body`; **no other writer in the
  window**. `ponca.db` + `ponca.history.db` `integrity_check: ok`; 0 `dirty` rows; 68 sections.
- Rendered prod (headless Chrome, human UA, after the 05:44:55Z snapshot rebuild): **68 sections,
  zero page errors**, structure dumped block-by-block and matching the plan — §7.5 `Íʼbahą̀`,
  §8.5 `Mąđí`, §9.7 `Full system of conjugations` (now between 9.6 and 9.8, i.e. after the six
  paradigms it summarizes), §10.2–10.6 (the five prefix charts, each under its own heading with its
  lead-in paragraph directly above; §10.1 Sé still first, §10.7 Gíđe last), §11.3 between `-tigđè`
  and `gá/á`. The TOC lists the new entries with correct numbering, and a cold load of
  `#section-<new id>` parks each new section at its 4rem scroll-margin line.
  Screenshots: `/tmp/ponca-lane6/shot-{prefixes,suffixes,s7-5,s9-7,s11-3}.png`, full page
  `/tmp/ponca-lane6/prod-grammar-full.png`.
  GOTCHA for the next verifier: the desktop TOC only expands the ACTIVE chapter's children, so
  "is my new title in the TOC?" is only meaningful once the scroll-spy has that chapter active —
  scroll to it (a hash-navigated cold load can leave the spy on the previous chapter).

### Tooling
**`scripts/ponca/promote-residual-subsections.py`** (stdlib only; imports Lane 2's script for the
blocks parser + `ASSIGN` so the two can never drift). Modes: `--plan [--bodies]` / `--verify` /
`--order` / `--apply --key=`. Two safety properties:
- **Guarded**: it refuses to run unless each parent body still matches the expected post-Lane-2
  block sequence, so it cannot double-move prose or run before Lane 2.
- **Idempotent**: the 9 section UUIDs are hard-coded, so a re-POST returns `created: false` and
  changes nothing; the parent PATCH is a no-op once trimmed.
Working files: `/tmp/ponca-lane6/` (pre/post prod dumps, `simulate.py` — a local dry-run that
applies the plan to a copy of the dump, including a Python port of `key_between`, and proves PDF
order BEFORE touching prod).
