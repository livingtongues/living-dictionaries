# Grammar page navigation — read-first, right-rail TOC

The `/{dict}/grammar` page grew from a single markdown blob into a section tree
(`.issues/structured-grammar.md`). Ponca — the first real one — is 59 sections / 77KB of prose /
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

## Scroll-spy mechanics worth not rediscovering

Sections render their children *inside* the parent's `.section` div, so a whole-section
IntersectionObserver reports the parent visible whenever any child is. The working model
(`scroll-spy.svelte.ts`) is instead: every landmark carries `data-grammar-anchor`, an IO with a
negative top `rootMargin` records each one's above/below state as it crosses a line just under the
sticky chrome, and **active = the last landmark in document order that is above the line**.
Nesting then works for free (a subsection's top comes after its parent's, so the deepest one you've
entered wins) and no scroll listener is needed. A `MutationObserver` re-scans because sections
appear as the dict DB loads and come and go while editing.
