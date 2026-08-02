# Create-dictionary page — video feedback (2026-08-02)

Screen-recording feedback from Jacob on `/create-dictionary` after commit `80489995`
("Improve operational reliability and dictionary onboarding"). Source video +
extracted frames: `/tmp/horse-feedback/2026-08-02_03-33-29-716/`.

Guiding rule Jacob restated on the recording: **do not hint to conlang authors that they
are being put in a different bucket.** Determined conlang authors can proceed and land in
their own corner; we just don't want people faking a real language. Also: *"Don't add
anything else on this page."*

## Items

1. ✅ Remove the `♡ Free` chip from the intro feature strip — the lede above already says
   "A Living Dictionary is a **free**, collaborative multimedia dictionary".
2. ✅ `create.lede_2` → just "Name your language to begin." (drop "It takes a few minutes,
   and you can read more about how it works further down the page.")
3. ✅ `create.faq_what_a` — drop the trailing "The platform is free, with no ads — built and
   maintained by Living Tongues Institute for Endangered Languages." (already on the home page)
4. ✅ Delete the whole "Can I create a dictionary for a constructed language?" FAQ
   (`faq_conlang_q` / `faq_conlang_a` + the `'conlang'` topic in the `faqs` array, which also
   feeds the FAQPage JSON-LD).
5. ✅ Revert the inline conlang copy to its pre-`80489995` state:
   - `conlang_terms_1/2` → `conlang_info_1/2` (original stricter wording)
   - restore `conlang_warning` + its `{#if !conlang}` block and `.conlang-warning` CSS
   - drop the newly added `conlang_hint` line (a bucket hint — see rule above)
6. ✅ BUG: the long-answer textareas were not full width — `.create-form` had a width rule for
   `input`/`select` but not `textarea`, so they fell back to the browser's `cols` default.
   (Item 9 of the report — "this button here" pointing at the resize grabber — is the same thing.)
7. ✅ Space between the `+` icon and the "Add" label on the `+Add` buttons (glossing languages,
   alternate names). Root cause: `.btn*` are `display: inline-flex` with no `gap`, and flex
   layout drops whitespace-only text nodes, so markup whitespace never renders.
   Fixed locally on the badge add-button in `BadgeArray` + `BadgeArrayEmit`.
8. ✅ Widen the form column — `.create-form` `max-width: 28rem` → `32rem`.

## Notes / not done

- A global `gap` on `.btn/.btn-ghost/.btn-outline/.btn-primary` would fix icon-label spacing
  app-wide (110 files use those classes) but needs a broader visual pass — left alone.
- Approved on the recording as-is: "Who are Living Dictionaries for?", "What do you need
  before you start?", "What happens after you create your dictionary?".

## Verification

- svelte-look `Visitor` / `VisitorDesktop` (SSR) — intro + FAQ changes confirmed.
- Real dev server (`localhost:3041`) driven headless with puppeteer for the interactive
  branches: default ("no" → warning restored) and constructed-language "yes" (original
  `conlang_info_1/2` italics, both textareas full width at 480px inside the 512px column,
  `+ Add` spacing). Script: `/tmp/shot-create.mjs`.
- `pnpm lint` clean, `pnpm check` 0 errors, `pnpm test` — only pre-existing failures.

### Pre-existing problems found (NOT caused by this work, not fixed)

- `_page.stories.ts` → `ConlangBranch` (the only `csr: true` story on this page, added by
  `80489995`) never renders: `[browser error] TypeError: Cannot read properties of undefined
  (reading 'env')` + a 404, then svelte-look's 10s mount wait times out. Fails identically on a
  clean tree. Other `csr: true` stories in the repo (e.g. `ReviewBanner`) render fine, so it is
  something in this page's client bundle. Worked around by verifying against the dev server.
- `src/routes/og/font-map.test.ts` (7) + `render-worker.test.ts` (1) fail on tuf on a clean
  tree — the machine is missing the CJK/Hebrew/Arabic/Thai system fonts those assertions expect.
