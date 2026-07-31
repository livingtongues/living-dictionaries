# Grammar page navigation — read-first, right-rail TOC

The `/{dict}/grammar` page grew from a single markdown blob into a section tree
(`.issues/structured-grammar.md`, git history). Ponca — the first real one — is 59 sections / 77KB of prose /
19 chapters, which is what forced the 2026-07-28 redesign
(`.issues/about-grammar-page-redesign.md`). These are the decisions behind it that the code alone
won't explain.

## Why the table of contents lives on the RIGHT

Jacob's instinct was "put it on the left" — the natural spot for nav. It can't go there: the
`[dictionaryId]` layout already owns a sticky left rail (`SideMenu`, 11–12rem). Two stacked left
rails burn ~26rem before a word of prose. The right rail is the docs-site convention (site nav
left, page contents right), keeps the two kinds of navigation visually distinct, and — the part
that actually matters — **bounds the prose column from both sides**. That's how the grammar page
satisfies Jacob's "never cap prose text to a readable max-width" rule while still not running
1600px lines: constrain the *container*, never the text.

Below 1024px the rail is replaced by a sticky "you are here" bar under the header. It is a
breadcrumb first and a menu second — deep inside 19 ALLCAPS chapters, knowing where you are is
worth as much as jumping.

## Read mode is the default, for editors too

Managers now have full structural editing, which meant every manager loaded the page into a
workbench: pencils, arrows, indent/outdent, trash, dashed "Add subsection" buttons on every node,
plus the clause-slot cog. Jacob's call: **editors want to see what a visitor sees first.** One
`Edit`/`Done` toggle in the header row swaps the whole workbench in and out. The About page's
header row (heading + Edit + Guidance) is the same pattern — reuse it for any future
view-or-edit dictionary page.

## Untitled sections are prefaces, not "section 1"

`build_section_tree` skips numbering for a **childless untitled** section. Two shapes produce
that: the blob→sections backfill's headless intro, and opening prose that sits above the numbered
chapters. An untitled section *with* children is structural and numbers normally. Without this
rule every migrated dictionary showed a bare "1" in front of its only paragraph.

## Ponca's root was flattened (2026-07-28, prod data repair)

The PDF import wrapped all 19 chapters under one top-level section titled "Notes on Ponca
Pronunciation and Grammar" — redundant with the page's own "Grammar" heading, and it pushed every
chapter to `1.1 … 1.19`. **The grammar page IS the root.** The chapters were promoted to top
level (their sibling `sort_key`s carry over unchanged at any depth); the old root kept its
1455-char preface body, lost its title, and moved to `sort_key = '9'` so it stays first as an
unnumbered preface. Script: `scripts/one-off/2026-07-28-ponca-flatten-grammar-root.cjs`.

Treat this as the template for any future PDF import that arrives with a redundant wrapper
section — flatten it rather than teaching the UI to hide it.

## Reference apparatus lives at the FOOT of the page (2026-07-29)

The clause-template strip was originally pinned above the whole section tree for any dictionary
with `clause_slots`. On Ponca that shoved the dictionary's own opening essay below the fold, so a
reader met a diagram of slots before a sentence of prose. Jacob's call: **the clause strip and the
glossing legend are both reference apparatus and belong at the bottom**, with their TOC entries
pinned in that same order. `+page.svelte` owns both landmarks now; `GrammarSectionsView` renders
sections only. The edit-mode "Edit clause slots" control deliberately stayed at the TOP — it is the
only way to create a first slot, and at the foot of a 77KB grammar nobody would find it.

## TOC clicks are deep links (2026-07-29)

Clicking a TOC entry writes `#section-<id>` with **`replaceState` from `$app/navigation`** — not
`pushState` (a TOC is clicked many times per read; 20 hash entries make Back useless) and not
native `history.replaceState` (SvelteKit dev-warns on that). The call is try/catch'd because
svelte-look mounts components with no router and `$app/navigation` throws there — svelte-look shims
`$app/state` only. Loading a URL that already carries a hash needs a **retry**: the browser's own
hash scroll fires long before the dict DB has streamed the sections in, so `+page.svelte` re-applies
the hash once (non-smooth) as rows arrive.

## The two headings mean "top of the page" (2026-07-29)

The page `h3` and the desktop rail heading both read "Grammar" and both are buttons: click either
and the page smooth-scrolls to the top AND the section hash is dropped (`clear_section_hash` in
`grammar-hash.ts`, which also owns the TOC's `write_section_hash`), so the URL stops claiming you
are inside a chapter. The mobile sticky bar is NOT a third copy of the heading — with no breadcrumb
to show it reads **"Contents"**, because the page heading immediately above it already says
Grammar. (It briefly read "Grammar" on 2026-07-29; Jacob's call was that duplicating the heading
wastes the one line of chrome mobile readers get.)

## Scroll-spy mechanics worth not rediscovering

Sections render their children *inside* the parent's `.section` div, so a whole-section
IntersectionObserver reports the parent visible whenever any child is. **IntersectionObserver was
tried and abandoned** (2026-07-28): with `threshold: 0` it fires only on visibility transitions,
never on top-edge crossings, so a section taller than the viewport kept its stale above/below flag
the entire time you were reading it — measured 40/40 wrong scroll samples. The current model
(`scroll-spy.svelte.ts`, whose header comment is the authority) measures landmark positions fresh
on each rAF-throttled scroll frame and takes the last landmark past its OWN `scroll-margin-top`
line. Active is still **the last landmark in document order above the line**, so nesting works for
free. A `MutationObserver` re-scans because sections appear as the dict DB loads and come and go
while editing.

## Section bodies render ABOVE their children — partition imports accordingly

`GrammarSection.svelte` renders `body → usage_conditions → example sentences → children`. A
chapter's own body therefore always precedes every subsection, and **a chapter can only read in
true document order if every one of its tables lives in a subsection**. Any table left in the
parent body jumps ahead of all the subsections no matter how the prose around it is arranged.

Ponca's PDF import ignored this: it concatenated all of a chapter's interleaved prose into the
parent body and pushed only the *captioned* tables into children, so "…as given here:" ended up
six paragraphs from its table. The 2026-07-29 repair came in two passes
(`.issues/ponca-grammar-round-2.md` Lanes 2 and 6), both moving text only — prose never created,
deleted or reworded, verified as identical multisets of exact strings before/after:

1. **Lane 2** (`scripts/ponca/repartition-grammar.py`) moved each paragraph into the child whose
   table it leads into or comments on — 38 sections. That got 5 of the 10 chapters into exact PDF
   order; the other 5 still held **uncaptioned** tables in the parent.
2. **Lane 6** (`scripts/ponca/promote-residual-subsections.py`) created the 9 subsections those
   tables needed (59 → 68 sections). All 10 chapters now match PDF block order.

**A title is not "new content" if you lift it.** Lane 6 looked blocked because a new subsection
needs a title and the PDF gives these tables no caption. The way through: take the title verbatim
from the section's own lead-in prose or table (`The adverbial prefix Áʼ-`, `Xíáđa ‘to fall’`), in
whatever naming style the siblings already use, and make the script ASSERT it — each title carries
a list of fragments that must appear (normalized) inside its own body, so a hand-written title
cannot silently smuggle in new wording.

**Lesson for the next grammar import: make one subsection per table group (lead-in prose + table +
follow-up commentary), including uncaptioned tables — never leave a table in a parent that has
children.**

Both scripts also model what a prod content-repair script should be: **guarded** (refuses to run
unless prod still matches the exact block sequence it expects, so it cannot double-move prose) and
**idempotent** (fixed UUIDs for created rows). Verify with an INDEPENDENT check that re-derives
order from the source artifact rather than from the plan — Lane 6's `--order` walks the prod tree
in render order (parent body → children, depth-first) and diffs it against the PDF block list; run
it BEFORE the write too, where it should reproduce exactly the known-bad chapters.
