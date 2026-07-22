# /translate — segmented progress bar, split pills, admin card status

Feedback from Jacob (2026-07-22 recording + follow-up) on the `/translate` page.

## Goals

1. **Admin badge** — shield-lock **icon only** (tooltip) on the admin "Progress" panel header,
   marking it admin-only.
2. **Admin panel to the very top** — the all-languages progress grid renders above everything
   (above the locale select/search). Non-admins never see it, so the page starts at the
   single-language interface. Admins switch language by clicking cards.
3. **Big per-language segmented progress bar** — full width, labeled, visible to EVERYONE. Four
   mutually-exclusive segments summing to total:
   - ✅ **reviewed** = has value & !needs_review → green (`--success`)
   - 🤖 **AI to review** = needs_review === 'ai' → **violet** (distinct from primary blue)
   - ⚠️ **English changed** = needs_review === 'en_changed' → amber (`--warning`)
   - ○ **untranslated** = no value → gray (`--color-secondary`)
   Computed client-side from `translate_store.rows` (no admin-only API needed → works for non-admins).
4. **Mini segmented bars in the admin cards** — same 4 colors, no labels. Needs the per-locale
   ai/en_changed split from the server summary.
5. **Split the "To review" pill into two** — `ai` + `en_changed`. New pill set (5):
   `All · Needs attention · Untranslated · AI translation · English changed`. The last three are
   legend chips with colored dots matching the bar; bar segments are clickable to activate that
   filter. All + Needs attention stay as plain chips at the front. Pills MOVE out of the toolbar
   into the big-bar block.
6. **Admin card status icons (icon + tooltip)** — per language:
   - **AI confidence** (3 groups): confident / decent-review-advised / don't-trust-unreviewed.
   - **Unpublished** indicator for locales in `UnpublishedLocales` (ha, am, or).

## Confidence data (from agent self-assessment; encode as constant)

- **confident**: es, fr, de, pt, zh, ru, hi, vi, id, ms, ar, he, bn
- **decent** (review advised): sw
- **low** (don't trust unreviewed): as, or, am, ha

## Data-layer changes

- `get_locale_stats` (`$lib/server/i18n/i18n-db.ts`): add `flagged_ai` + `flagged_en_changed`
  (`SUM(needs_review = 'ai'|'en_changed')`); keep `flagged` (= sum) for notify/email consumers.
  Update `LocaleStats` interface + the vitest.
- `summary/server.test.ts` expects the new fields.

## Component plan

- `constants.ts` (translate): add `TRANSLATE_FILTERS = ['all','pending','missing','ai','en_changed']`,
  updated `FILTER_LABELS`, category color/label meta, `LOCALE_AI_CONFIDENCE` map + confidence meta,
  and an `is_unpublished_locale` helper (from `UnpublishedLocales` keys).
- `segmented-bar.svelte` (new) — presentational: `{ counts:{reviewed,ai,en_changed,untranslated}, total, size?, active?, onpick? }`.
  Colors via `var(--cat-*)` custom props (with hardcoded fallbacks so isolated stories still color).
- `translate-progress.svelte` (new) — big bar block: locale name + "X/Y reviewed", full segmented
  bar, filter row (All/Needs-attention chips + colored legend filters). Props: `counts`, `total`,
  `locale`, `filter`, `on_pick_filter`.
- `admin-panel.svelte` — badge icon; mini segmented bar per card; confidence + unpublished icons.
- `+page.svelte` — reorder (admin panel top), remove pills from toolbar, add `<TranslateProgress>`,
  define `--cat-*` on `main`, extend `counts` with reviewed/ai/en_changed, update filter logic.

## Verification

- Vitest: i18n-db + summary server tests; constants test for filters/confidence.
- svelte-look Admin + Translator stories (light + dark); update `_page.stories.ts` summary data
  with flagged_ai/flagged_en_changed and add a low-confidence/unpublished locale card.
- `pnpm check` + `pnpm lint`.

## Progress

- ✅ Data layer — `get_locale_stats` now returns `flagged_ai` + `flagged_en_changed` (kept `flagged`
  for notify/email); updated i18n-db + summary server tests.
- ✅ constants — new 5-pill `TRANSLATE_FILTERS`, `PROGRESS_CATEGORY_META` (colors via `--cat-*`),
  `LOCALE_AI_CONFIDENCE` + `ai_confidence_for`, `is_unpublished_locale`; + tests.
- ✅ `segmented-bar.svelte` — mini/full, clickable full segments, focus-dimming; own story.
- ✅ `translate-progress.svelte` — big labeled bar + legend/pill row (All · Needs attention |
  Untranslated · AI translation · English changed).
- ✅ `admin-panel.svelte` — shield admin badge (icon+tooltip), mini segmented card bars, per-card
  AI-confidence icon (check/alert/flag) + unpublished eye-off, all tooltipped.
- ✅ `+page.svelte` — admin panel hoisted to very top; pills removed from toolbar; big bar for
  everyone; `--cat-*` palette defined on `main`; filter logic + counts updated.
- ✅ `translate-row.svelte` — AI review chip recolored violet to match the palette.
- ✅ Stories updated (`_page.stories.ts` split fields + sw/as/ha cards) + segmented-bar story;
  screenshots verified light + dark, desktop + mobile.
- ✅ `pnpm check` 0 errors · eslint 0 errors (only pre-existing warnings) · vitest 34/34 in
  translate+i18n.

## Palette (defined on `main` in +page.svelte, `--cat-*` with hardcoded fallbacks in constants)

- reviewed → `--success` (green) · ai → violet `light-dark(hsl(258 70% 60%), hsl(258 78% 74%))`
- en_changed → `--warning` (amber) · missing → gray `light-dark(hsl(240 5% 74%), hsl(240 5% 42%))`
