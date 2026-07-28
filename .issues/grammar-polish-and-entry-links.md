# Grammar page: scroll-spy fix, table widths, Ponca de-CAPS, entry auto-links

Four workstreams from Jacob's 2026-07-28 review of https://livingdictionaries.app/ponca/grammar.
All decisions below are Jacob-approved unless marked OPEN.

## 1. Scroll-spy accuracy fix

Symptom (desktop, clicking TOC entries + scrolling): active TOC highlight "jumps around" and
doesn't track the top heading. Jacob's spec: **the active section = whatever heading is at the
top of the reading area** (the last heading scrolled past the top line).

Current impl: `site/src/routes/[dictionaryId]/grammar/scroll-spy.svelte.ts` — IntersectionObserver,
fixed 104px offset line, `data-grammar-anchor` on whole **section containers** (nested divs), active
= last anchor in doc order whose container top is above the line.

Suspects found by reading:
- Fixed `DEFAULT_OFFSET_PX = 104` vs actual chrome: desktop rail is `top: 3rem` (48px), section
  `scroll-margin-top: 4rem` (64px) desktop / 7rem (112px) mobile. Mismatched lines mean a TOC click
  can land a section at 64px while the spy line sits at 104px — the *previous* section's container
  still spans the line region and boundary jitter flips the highlight.
- Anchors are nested containers, not headings — a parent's top is its first child heading, but the
  parent stays "above the line" for its whole height, so correctness rests entirely on the
  last-in-doc-order rule + accurate above/below bookkeeping from IO callbacks; any missed/late IO
  callback (smooth-scroll, image loads triggering MutationObserver rescans that wipe `above = {}`
  and re-measure mid-scroll) shows as jumping.
- `rescan()` resets `above` and re-measures during smooth scrolls (MutationObserver fires on any
  DOM churn, e.g. lazy content), momentarily mis-classifying.

Plan:
- ✅ Reproduce first with puppeteer on the live Ponca page (public, no auth): click TOC entries,
  scroll, log `spy.active_id` vs actual topmost heading. Confirm the failure mode before rewriting.
- Rewrite to the simple, deterministic rule: on scroll (rAF-throttled passive scroll listener),
  compute each section's HEADING position (`.head` element, not the container) via
  `getBoundingClientRect`, active = last heading with `top <= chrome_offset + epsilon`; derive
  `chrome_offset` from the same breakpoint values as `scroll-margin-top` (or measure the sticky
  chrome). Keep the MutationObserver only to re-collect the heading list. Positions are computed
  fresh each scroll frame — no stale above/below cache to corrupt.
- Keep the class API (`active_id`, `watch`) so TOC/breadcrumb code is untouched. Update/extend
  `grammar-toc.test.ts` where pure logic changes; verify by re-running the puppeteer script.

## 2. Natural-width tables (global tw-prose)

`site/src/lib/typography.css` forces `.tw-prose table { width: 100% }` → short paradigm tables
stretch across wide pages, hurting readability.

- Change to `width: fit-content; max-width: 100%` (left-aligned by default). Restore modest
  first/last-cell padding if needed (current rules zero the first col's start padding + last col's
  end padding — fine to keep; with fit-content the cell padding carries the spacing).
- Applies to ALL tw-prose surfaces (grammar, about pages, entry notes, markdown previews) —
  Jacob-approved global.
- Consider `overflow-x: auto` wrapping is NOT needed (tables already `max-width: 100%` +
  `table-layout: auto`); check a genuinely wide Ponca paradigm table at narrow width anyway.
- Verify with svelte-look stories + puppeteer screenshots of grammar (wide + narrow), an about
  page, and entry notes.

## 3. Ponca ALL-CAPS rewrite (prod data edit)

Prod: dict `ponca`, `grammar_sections` — 19 top-level chapter titles ALL CAPS; 15/59 bodies have
ALL-CAPS runs (mostly table headers SINGULAR/PLURAL/PERSON/PONCA WORD/ENGLISH/OMAHA…, plus suffix
gloss labels like CAUSE/NEGATION/WANT OF in 13f97ae7).

Decisions:
- Titles → **Title Case** ("The Ponca Verb", "Parts of Speech"). Subsections already normal-case —
  leave untouched (they're sentence-ish case with capitalized vernacular; do NOT re-case them).
- Vernacular forms keep the dictionary's own capitalization convention (Ą-, Đihą́, Wá-) exactly —
  never case-fold vernacular. In ALL-CAPS titles the vernacular was also shouted (ĐI- → Đi-); restore
  per the convention used in the normal-case subsection titles.
- Body ALL-CAPS: normalize table headers + shouty labels with judgement (SINGULAR → Singular).
  Leave genuine glossing-abbreviation conventions alone.
- Fix spotted data typo while in there: section 80010e3f title says `Second person singular subject
  (“I”)` → should be `(“you”)`.
- Path: v1 grammar API against prod with an admin API key (synced + history-tracked), PATCH
  `title` / `body` per section. Read-back verify + eyeball the live page after.

## 4. Clickable entry links in grammar prose (render-time auto-matching)

Direction: any word in the grammar that matches a dictionary entry becomes clickable — popover
mini-card (headword, gloss, ▶ audio when present, "View entry →"); homographs list all candidates.
No stored data, no confirmation workflow (v1). Long-term (Jacob): may pair auto-matching with
manual matching for short forms — design keeps room for a stored override lane later.

Mechanism: a reusable attachment applied to the grammar page's rendered `{@html}` bodies (and
usage blocks). Walks text nodes, tokenizes, matches against a lexeme index, wraps matches in
clickable spans. Builds on corpus infra but with a STRICTER key.

### Matching rules (CONFIRMED by Jacob 2026-07-28, grounded in Ponca data)

Data facts: 5,257 entries; ~31 single-CHAR entries (the whole alphabet: a b d e g h i … đ š ž —
letter entries for the pronunciation guide); ~130 lexemes ≤4 chars; corpus
`normalize_token_form` strips diacritics + lowercases ('Toré'→'tore'), which would collide English
prose with folded forms (me→Méʼ, se→Séʼ, I→i). Grammar prose is carefully diacritic'd; vernacular
is conventionally **bold** (but bold is also used for English grammar terms).

1. **Diacritic-EXACT key** (new, grammar-only): NFC + lowercase + apostrophe-variant unification;
   NO diacritic stripping. Kills essentially all English collisions.
2. **Short-form guard**: forms whose key is ≤2 chars AND pure ASCII only match inside
   bold/italic spans ("the letter **a**" links; plain-prose English "a"/"I" never does). Everything
   ≥3 chars or carrying non-ASCII matches anywhere (prose + table cells).
3. **Affix entries** ("-čábe", "-ata"): index both with and without the leading hyphen, so
   "čábe" and "-čábe" in prose both hit the affix entry.
4. **Multi-word lexemes** match greedily longest-first over consecutive tokens (existing corpus
   behavior, e.g. "Đįgé gáxe").
5. Scope: rendered section bodies + usage blocks incl. table cells. Section titles: v1 skips
   (they're structured flex layouts, lower value); revisit.

### Implementation sketch

- `$lib/corpus/` (or `$lib/grammar-links/`): `build_exact_lexeme_index(entries)` (share the
  id+lexeme query from `load_lexeme_index` / `sentence-analysis.ts`), `link_entry_words`
  attachment. Index built once per page (5k rows is cheap), rebuilt on entries change if easy via
  live rows, else on mount.
- DOM walk: skip existing `<a>`, code/pre. TreeWalker over text nodes; for marked-ness check
  ancestor strong/em. Wrap hits in `<button class="entry-word">`/`<a>` styled span.
- Popover: borrow from corpus `TokenPopover` / entry mini-card patterns; needs headword (via
  `get_headword` + orthographies), first gloss, audio playback (reuse entry audio component/URL
  helpers), link to `/{dict}/entry/{id}`. Candidates list for homographs.
- Audio: Ponca currently has none — test popover audio path on a dict that has audio (or dev data).
- Styling (CONFIRMED): faint dotted underline, stronger on hover. Not color-tinted (link-farm) and
  not hover-only (fails on touch).
- Ship on grammar page first; attachment stays generic for about page later.

## Execution order

1. ✅ Plan + Jacob decisions
2. ✅ Scroll-spy: reproduced → rewritten → verified (puppeteer)
3. ✅ Tables CSS + screenshots (grammar wide/narrow + editor)
4. ✅ Ponca caps rewrite via prod API — applied + read-back verified
5. ✅ Entry-link matcher + popover — shipped on the grammar page

## What landed (2026-07-28)

### Scroll-spy (DONE)
ROOT CAUSE, confirmed by measurement, not guesswork: the IntersectionObserver
recorded each landmark's above/below state from IO callbacks, but IO with
`threshold: 0` fires only on VISIBILITY transitions, never on top-edge crossings.
A section taller than the viewport (Ponca's pronunciation guide = 13KB of prose)
therefore kept the `above: false` it was handed when it first appeared at the
viewport BOTTOM until it scrolled fully out the top. Measured before the fix:
**40/40 scroll samples wrong**, TOC blank from y=800 to ~y=7000, and clicking
"3 THE PONCA VERB" highlighted "2 PARTS OF SPEECH".

FIX (`scroll-spy.svelte.ts`, rewritten): rAF-throttled passive scroll listener
measures landmark positions fresh each frame; active = last landmark whose top
passed the line. The line is each landmark's OWN computed `scroll-margin-top`
(+4px epsilon) — the same line `scrollIntoView` parks it on — so a TOC click and
the spy can't disagree at any breakpoint and there's no magic constant to keep in
sync with the CSS. `scroll-margin-top` is read on rescan (structural change /
resize), not per frame. MutationObserver stays childList-only so the TOC's own
active-class churn can't retrigger a rescan.

VERIFIED: desktop 1600px 3/58 mismatches (all 3 at y<800, before any chapter —
harness artifacts, not bugs), chapter clicks 0/7, subsection clicks 0/4, mobile
420px crumb 0/41 and no longer blanks mid-chapter. Scripts in `/tmp/gr/`.

### Tables (DONE)
`typography.css`: `.tw-prose table` `width: 100%` → `width: fit-content;
max-width: 100%; display: block; overflow-x: auto`. Columns hug content and the
table left-aligns. The first mobile check missed that `max-width` cannot shrink
a table below its intrinsic minimum: Ponca's six-column paradigm widened a
420px document to 602px. The final rule makes that one table scroll inside its
380px box instead (document width 420px, `scrollX = 0`) while natural-width
tables still hug their content on desktop.

Verified in the live page with an injected copy of the final rule, local dev
with the actual CSS, and the new `GrammarSection/WideTable` svelte-look story:
light + dark at 420px and 900px. The story keeps the wide-table regression
visible.

### Entry links (DONE)
New `site/src/lib/entry-links/`:
- `exact-lexeme-index.ts` — diacritic-EXACT key (NFC + lowercase + apostrophe
  unification; NO diacritic folding, unlike the corpus matcher) + `is_linkable_key`
  short-ASCII guard. Edge hyphens drop from keys on both sides, so `-čábe`↔"čábe"
  and `A-`↔"**A-**" resolve without a second index entry.
- `find-entry-mentions.ts` — pure greedy longest-phrase-first scan over one text run.
- `link-entry-mentions.ts` — the DOM attachment (TreeWalker, skips a/code/pre/
  button/contenteditable/`.no-entry-links`, marks via strong/b/em/i ancestor).
- `EntryMentionPopover.svelte` — headword · POS · gloss · ▶ audio · "view entry",
  homographs listed; play column reserved so mixed-audio rows align.
- `mention-context.ts` — context (not props) because the section tree is recursive.
Wired in `grammar/+page.svelte` (index built from `$entries_data`, skipped in edit
mode) + `GrammarSection.svelte` (attachment on each body/usage block, dotted-underline
`:global` style).

GOTCHA worth keeping: the DOM walk MUST be deferred one `requestAnimationFrame`.
Rewriting `{@html}` children synchronously inside the attachment races Svelte's
mount/hydrate of that subtree, which then reclaims the original text nodes and
silently drops every link.

GOTCHA #2: **svelte-look renders SSR-only by default** (`svelte/server` `render()`),
so attachments and portals never run and the story looks silently broken. Stories
for client-only behaviour need `csr: true` (+ `interactions` to wait/click) — it's
in the svelte-ui skill under "SSR vs CSR"; read it before assuming a story is wrong.

MEASURED on live Ponca (5,257 entries, local copy): 480 mentions, 171 distinct
forms, 96 homograph mentions, zero page errors. Spot-checked: vernacular
(`A-`, `Đi-`, `Wá-`, `Đihą́`, `kig-`, `đ`) links; bold ENGLISH grammar terms
("dual marker", "first person subject", "agent", "patient") does not; the article
"a" in running prose does not, while "the letter **a**" does.

## Ponca caps rewrite — DONE in production

The Ponca review session confirmed it had finished and made no
`grammar_sections` writes. Immediately before mutation:

- Current-prod dry run: **28 / 59 sections** needed a change (19 chapter titles,
  15 bodies, with overlap).
- Zero-downtime online backup uploaded to
  `r2/backups-rolling/db/living/2026-07-28T10-04-41Z.tar.zst`.
- A scoped write key attributed to Jacob was minted with label
  `Ponca grammar de-CAPS 2026-07-28`.

`scripts/ponca/decaps-grammar.cjs` PATCHed all 28 sections through the v1 grammar
API. Fresh production reads then proved:

- Planner: **0 / 59** remaining changes.
- Main DB `integrity_check`: `ok`.
- No title retains an ASCII ALL-CAPS run.
- `80010e3f` is exactly `Second person singular subject (“you”)—Đihą́ ‘to lift’`.
- History DB: 28 `grammar_sections` update events, 28 distinct rows, attributed
  to key `6cf4b8c3-b4b8-4740-94fe-72795d72f703`; integrity `ok`.
- The key was revoked at `2026-07-28T10:08:58.380Z`.

Rendered production verification (human UA is required because the site
deliberately skips browser DB boot for detected bots): 61 anchors, 58 titled
sections, all sampled titles/body labels present, old typo absent, zero
all-caps chapter titles. Desktop screenshots show the rewritten TOC and
lowercase suffix labels; mobile shows the same titles.

## Follow-ups / not done
- Entry links are grammar-only so far; the attachment is generic and the about
  page is the obvious next surface.
- Phrase matching stops at element boundaries (a bolded first word of a two-word
  lexeme won't match the phrase). Fine for v1.
- Section TITLES are not scanned for mentions (structured flex layout, lower value).
- No stored override lane yet — if a link is ever wrong or missing, the escape
  hatch would be a dict-level list, mirroring `ignored_forms` in the corpus.

## Verification tooling
- Puppeteer against live Ponca + local dev, with runtime/page errors captured.
- svelte-look: grammar stories plus `GrammarSection/WideTable` at 420px/900px,
  light/dark.
- `pnpm exec vitest run`: 313 files passed, 2,311 tests passed, 3 skipped.
- `pnpm exec tsc --noEmit`, root `pnpm lint`, and `pnpm check`: clean
  (`svelte-check` has 0 errors and the existing 46 warnings).
