# Ponca report audit + questions for Greg

Jacob is happy with the Ponca import (2026-07-29). Two jobs: (1) audit the posted report
artifact against the four previous ones + guide §2.8, (2) propose the questions to file on
the conversation for Greg.

## State on prod (verified 2026-07-29)

Thread `523ba8fe-3ce9-4e0e-9700-a3c0e89727db` (dictionary `ponca`, from Gregory Anderson,
assigned to Jacob, unresolved):
- **0 messages** — Greg has never been notified anything happened.
- 1 artifact `a10d5a1c-c7d5-4fc5-b7b2-ef745ea5f0a8` (kind `report`, 274,886 bytes, posted
  2026-07-28T11:28Z) — byte-identical to `~/import-work/ponca/report.html`.
- **0 thread_questions.**

Comparison across all five import threads:

| dict | report bytes | TOC + collapsible sections | thread_questions | messages |
|---|---|---|---|---|
| eastern-pomo | 82,882 | ✅ (`artifact.py` shell, 8 sections) | 6 | 1 |
| iipay-aa | 167,153 | ✅ (11 sections) | 6 | 2 |
| catawba | 26,445 | ✅ (7 sections) | 3 (**3 answered**) | 5 |
| enxet | — (no artifact) | — | 0 | 3 |
| **ponca** | **274,886** | ❌ **none** | **0** | **0** |

Ponca's `report.py` does NOT use the shared `artifact.py` shell the other three share
(`~/import-work/{eastern-pomo,iipay-aa}/artifact.py` — `Doc`/`Section`/`entry_card`, CSS with
`details.sec`, stats grid, `<nav class="toc">`, expand/collapse tools).

## Audit findings

### A. Structure — the collapsible-sections gap Jacob noticed

1. **No table of contents.** Guide §2.8 explicitly requires "the same table of contents +
   collapsible sections" as the preview. 13 flat cards, 7,485px collapsed at 1100px wide
   (~11 screens in the 70vh inline frame), 34,491px with every `<details>` open (~49 screens).
   No jump list.
2. **No top-level collapsible sections.** Ponca has 12 `<details>` but all of them are deep
   lists *inside* two cards. The other reports made every section a `<details class="sec">`
   with its count right-aligned, open by default except "cross-section"/"for the record".
3. **No stats grid.** The others open with 6–9 big-numeral cards. Ponca's label/number table
   is good content but reads as a wall.
4. **No heading hierarchy.** One `<h1>`, zero `<h2>`/`<h3>` — every section title is a styled
   `<div>`. No document outline, no reader mode, and only 6 elements in the whole 274KB
   document carry an `id`, so `report_anchor` has almost nothing to point at.

### B. Content gaps

5. **Zero links out to the dictionary.** 649 entry links, but not one to `/ponca`,
   `/ponca/grammar`, `/ponca/about`, or `/ponca/entries` (`grep href` → 0 non-entry hrefs;
   eastern-pomo linked its dictionary home twice). The report's own opening sentence advertises
   the Grammar page (59 sections · 73 rebuilt tables · 68 interlinear glossed examples · 65-code
   legend) and the About page and makes neither clickable. This is the single most impressive
   output of the import.
6. **The review-queue section doesn't link to the review queue.** It explains the "Needs review"
   filter in prose. These URLs work today:
   `/ponca/entries?q={"page":1,"has_review":true}` (38) and
   `…{"review_categories":["possibly-two-words"]}` (20) / `["definition-differs"]` (16) /
   `["respelling-differs"]` (2).
7. **No `thread_questions`.** The three questions are prose inside a script-blocked iframe with
   no answer box. Guide §2.8 "Then file the questions as answerable objects" not done.
8. **No `entries_query` buttons** — the feature built 2026-07-29 *because* 15 questions across
   five imports got 3 answers. Ponca uses none.
9. **Thread has 0 messages.** Artifacts don't email; only a message does.

### C. Smaller

10. Two of the three question titles aren't questions (guide: "ending in an actual question") —
    "A small pronunciation question only a speaker can settle: the m before b" and "Stress marks:
    we sided with the main dictionary — overrule us any time".
11. Verification prose ("Checked against the printed pages — three times") sits at full weight in
    the main flow; the other reports demote "How this was checked" to a closed section.
12. **Unused affordance:** artifacts are served with `img-src data:` (see
    `…/artifacts/[artifact_id]/+server.ts`), so base64 page crops ARE allowed. Ponca is the only
    import with real scanned page crops (`~/import-work/ponca/crops/`, ~40 images) and shows none.
    5MB artifact cap leaves plenty of room.

## Bug found + FIXED (2026-07-29)

**Report links navigated the iframe, not a new tab.** All four shipped reports emit `<a href>`
with **no `target`** (ponca 649, iipay 413, pomo 173, catawba 39 — all zero `target="_blank"`).
`SandboxedFrame` grants `allow-popups allow-popups-to-escape-sandbox` *for exactly this*, but
those flags only do anything when the link asks for a new tab. Without one, the click navigates
the frame itself — and the frame has no `allow-scripts`, so livingdictionaries.app loads as a
dead scriptless shell in a 70vh box with no way back.

Reproduced headlessly (`/tmp/ifr/`): before → frames become `["host","entry.html"]`, no new tab;
after → report stays put and the entry opens in its own tab.

Fixed **parent-side** in `$lib/components/ui/SandboxedFrame.svelte` `on_load()` — the host page
already has `allow-same-origin` and already reaches into `contentDocument` to measure height, so
it now also sets `target="_blank" rel="noopener"` on every non-`#` link. Chosen over fixing the
builders because it repairs **all four already-filed artifacts** retroactively. In-document `#`
anchors are skipped so a TOC still works inside the frame.

Verified: `tsc` clean · `eslint` clean · `pnpm check` 0 errors.

## Jacob's rulings (2026-07-29)

1. **Port Ponca onto the shared shell** so all future reports are one codebase — but keep it
   flexible: lose nothing from the current report, and don't stuff in sections it doesn't need.
2. **No page crops.** Text-only.
3. **Three questions**: gendered forms · the m-before-b · related forms promoted to entries.
   (NOT the review-queue/domains/audio/pronunciation-orthography ideas; the stress-mark write-up
   stops being a question.)
4. Going public is **not part of the import workflow** — never raise it here again.
5. **Draft the message, don't post it.**

## DONE — report v3 shipped to prod 2026-07-29

### The shared shell — `scripts/import-report/artifact.py` (NEW, in the repo)

`Doc` / `Section` (contents, stats, destination chips, collapsible sections) + optional content
helpers (`numbers_table`, `glyph_chips`, `bullets`, `deep`, `rows`, `flag`, `entry_card`) +
`Linker` (the only way to print a headword; raises on an unknown word, `assert_complete()` proves
no other path emitted an entry link) + `question()`.

Deliberately a **toolkit, not a template** — `Section.add()` takes arbitrary markup, so Ponca's
bespoke pieces (the letter chips, the flag cards, the book-shaped entry cards with literal
readings and examples) all survive and a spreadsheet import skips them. Three things the two
copy-pasted `artifact.py` files got wrong, now fixed in one place:

- **The font stack.** Both copies used `-apple-system` / `Helvetica`; Ponca's used `system-ui`.
  LD's `theme.css` bans all of those *because Mac Chrome's `.SF NS` stacks combining diacritics
  over a dotted i instead of replacing the dot* — and a report is mostly diacritic-heavy
  headwords. The shell uses LD's `--font-sans`.
- **A permanently invisible "Expand all" button.** CSP blocks scripts in the artifact, in the
  iframe AND in a standalone tab. Dropped, with a comment so nobody re-adds it.
- **`Doc.render()` now refuses** to close a section that holds a filed question's `report_anchor`
  — without script, a jump can't expand a collapsed `<details>`.

`question()` emits the report block AND the `POST …/questions` payload from one call, so the
report's wording and the answer card can't drift.

### Ponca report v3 (`~/import-work/ponca/report.py`, v2 backed up beside it)

12 sections, 5 closed by default. Collapsed 6,214px (was 7,485), fully expanded 32,864px.
259,663 chars / 268,053 bytes. Every v2 paragraph carried over. New:

- Contents + 6 stat cards + destination chips (**Open the dictionary** · Grammar page — 59
  sections · About page · All 5,257 entries · **The 38 review flags**).
- Per-category review-queue links. Verified live against the local prod-copy DB — the four
  filters return **exactly 38 / 20 / 16 / 2**.
- Stress marks moved out of the questions card into "How the linguistic decisions were made";
  related forms moved in as question 3.

### The three questions (filed, `status: open`)

All `kind: choice` with an "I'll ask a speaker" escape, all with a working `report_anchor`.

**None carries an `entries_query`, and that is deliberate.** The gendered-forms set (37 entries)
is identifiable only by "masc."/"fem." inside definition text, and the entries view's only text
facet is the Orama search at `tolerance: 1`: `"masc."` returns **69** rows led by *máse* "to cut
something", `"fem."` returns 78 led by *femur*. `tolerance` is in `QueryParams` but is NOT read
from the URL `q` param, so it can't be forced to 0 from a link. A button onto the wrong rows is
worse than no button (`entries-query-link.ts` says so itself). Guide §2.8 now tells agents to
open the URL and count before filing a `query` button.

> **Product gap worth a follow-up:** there is no way to point a question at an arbitrary set of
> entries. Every facet is categorical; free text is fuzzy. An `entry_ids` option on
> `entries_query` (or a URL-readable `tolerance: 0`) would have made this button possible.

### Bug fixed and DEPLOYED

The `SandboxedFrame` `target="_blank"` fix (above) went out in commit `b16040f3`, deployed to
prod 09:58Z; the built chunk `nodes/17.*.js` contains it. Verified end-to-end on the real
conversation page: 674 links in the frame, **662 got `target="_blank"`, the 12 `#` contents
anchors correctly left alone**; clicking a headword opens the live entry in a new tab while the
report stays put; clicking a contents row scrolls the frame in place.

### Prod operations performed

- Backed up `shared.db` → `shared.db.bak-20260729-105858`.
- Minted write key `d96d6e03…` (label "report v3 + questions 2026-07-29", attributed to Jacob),
  POSTed artifact + questions, **revoked it** (401 verified). No live ponca keys remain.
- New artifact `694f6175-e2cb-4f7c-b646-abe906ab29b6` (268,053 bytes) — byte-identical to local.
- Old artifact `a10d5a1c…` deleted from BOTH `thread_artifacts` and R2
  (`import/ponca/artifacts/…`); the R2 prefix now lists exactly one object. `integrity_check ok`.
- Thread still at **0 messages** — Greg has not been notified. That is Jacob's step.

### Docs updated

- `scripts/README.md` — `import-report/` called out as the exception to "this folder is history".
- Guide §2.8 (`importing.md`) — points the team at the shared shell; checklist gains items 6-8
  (link to the dictionary not just entries · the font stack · don't set `target` yourself); the
  `entries_query` section gains the verify-before-filing rule with the Ponca numbers.

### Local dev leftovers (harmless, local only)

`site/.data/shared.db` now has a seeded ponca import thread (same id as prod) + a Greg user +
one test artifact/question set, created to verify the conversation page. Delete if it ever
confuses a test.

## The message to Greg — DRAFT, for Jacob to post

Post from `/ponca/import/523ba8fe-3ce9-4e0e-9700-a3c0e89727db`. Posting it is what emails him.

> Hi Greg,
>
> The Ponca dictionary is in — the whole book, not a subset. 5,257 entries with 5,617 meanings,
> the grammar sketch rebuilt as a real Grammar page (all 73 charts as tables, and the 68 example
> sentences as word-by-word glossed text), the preface and the Council of Elders acknowledgments
> as the About page, and the jacket photograph as the cover for now.
>
> There's a full report above. It's written for someone who wants to see how the sausage was
> made — what we decided and why, what the book's two typesettings disagreed about, and what we
> settled ourselves versus what we left for a human. Every Ponca word in it links straight to its
> live entry, so you can check anything we claim with one tap.
>
> Three questions at the top of the report have answer boxes right below it — none of them blocks
> anything, but each one settles something for the whole dictionary. There are also 38 entries
> flagged "needs review": genuine questions about the language that only a speaker can settle.
> They're invisible to visitors and there's no deadline.
>
> Have a look around and tell me anything that reads wrong — changes are still cheap at this
> stage. Nothing is public; that stays entirely in your hands.

Notes for Jacob before posting:
- The dictionary's only role-holder is **Cailie Keating** (ck1105@georgetown.edu, manager).
  Greg has no role on ponca — he's a level-2 site admin, so he can see it either way, but if
  Cailie is the one who will work the review queue she may want the message too.
- After posting, resolve the conversation at `/admin/imports`.
- Greg's own words on the request: *"I am not part of the Ponca community but am in contact with
  a member of the community who wishes to create a Living Dictionary. I am acting as a
  facilitator."* — so "ask a speaker" answers will go through him to someone else. That is why
  every question has an "I'll ask a speaker first" option.
