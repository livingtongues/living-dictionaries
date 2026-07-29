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

## Proposed report v3 changes (pending Jacob's ruling)

Mockup built by DOM-transforming the live report in puppeteer (`/tmp/mock.mjs` →
`/tmp/mock-ponca.png`): keeps Ponca's own card design, adds a 2-column Contents card + a row of
destination chips (Open the dictionary · Grammar page · About page · All 5,257 entries · The 38
review flags), and turns each card into a `<details>` with an `<h2>` summary + right-aligned
count. Five sections default closed → collapsed height drops 7,485 → 5,683px.

## Proposed questions for Greg (pending Jacob's ruling)

Greg is a **level-2 site admin**, the facilitator not a community member ("I am not part of the
Ponca community but am in contact with a member…"). The dictionary's only role-holder is
**Cailie Keating** (ck1105@georgetown.edu, manager) — Greg has no role on it.

Facets available for `entries_query` on ponca: `sources:["headman-oneill-2019"]` (5,257) ·
`has_review` (38) · `review_categories` (20/16/2) · `orthographies:["pronunciation"]` (4,667) ·
`no_semantic_domain` (all 5,617 senses) · `no_audio` (all) · `no_part_of_speech` (618 senses) ·
`query:"masc."` (37 entries with masc./fem. definitions — `_definitions` is Orama-indexed).
