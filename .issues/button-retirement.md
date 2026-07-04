# Retire legacy ui/Button.svelte without a big-bang visual churn

Jacob (2026-07-04): wants the legacy vendored `ui/Button.svelte` (own `form`/`size`/`color` API,
compiled sp-* styles) gone and buttons modernized, BUT not as one giant hard-to-review UI change.
His stated taste: **"I really like the clean look of buttons without any background or border,
just a slight hover change"** — i.e. the ghost/text style, minimal chrome.

Scope: LD has ~56 files importing it; house ~13 (`house/site/src/lib/components/ui/Button.svelte`).
Replacement targets: `HeadlessButton` + global `.btn-*` classes (svelte-ui skill), leaning
`btn-ghost`-like per Jacob's preference.

## Strategy proposal (draft — refine before starting)
1. **Inventory by variant**: map every call site's `form=` (`filled|outline|text|simple|menu`) ×
   `color` × `size` to its nearest `.btn-*` equivalent. Many `form="text"`/`form="simple"` sites are
   already Jacob's preferred look — those migrate with near-zero visual delta and go FIRST.
2. **Batch by route/section** (one PR-sized chunk each, svelte-look/e2e screenshots per batch) so
   each visual change is reviewable in one sitting: e.g. admin area (internal, lowest risk) →
   header/shell → entries UI → settings/about pages.
3. For genuinely filled CTA sites, `btn-primary`; deliberate restyle, flag per batch for Jacob.
4. Add temporary lint guard (`no-restricted-imports` on `ui/Button.svelte`) once its section is
   migrated, to stop regressions; delete the component + its compiled styles at the end.
5. Mirror in house afterwards (13 files) using the same variant map.

Related: `.issues/ui-skill-alignment.md` (phases 2-3 cover the same direction; this issue is the
concrete execution plan for the Button piece).
