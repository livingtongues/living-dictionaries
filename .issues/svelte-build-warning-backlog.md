# Svelte production-build warning backlog

The 2026-07-21 import-resource verification build succeeds, but it exposes an existing cross-feature
warning backlog. This is unrelated to import management and spans enough surfaces to deserve a
separate audited cleanup rather than opportunistic edits.

## Findings

- Several scoped CSS selectors are reported unused (`print-hidden`, create form select, icon gap,
  API-doc auth note code, health noise rows, schema panel positioning, video heading icon).
- Several components intentionally or accidentally capture initial prop values outside closures;
  each needs an owner-aware review before changing initialization semantics.
- `Badge.svelte` can render a button inside a button when its removable form is placed in a button,
  which Svelte flags as invalid SSR HTML with hydration-mismatch risk.
- wa-sqlite emits tolerated bigint target-transform warnings, and several existing dynamic imports
  are ineffective because the same modules are statically imported elsewhere.

## Plan

- [ ] Classify warnings as real defect, intentional initialization, or compiler false positive.
- [ ] Fix invalid interactive nesting and add a hydration/browser regression test.
- [ ] Remove or correctly globalize truly unused selectors.
- [ ] Resolve prop-capture warnings without changing modal/editor reset behavior.
- [ ] Decide whether wa-sqlite target and ineffective-import warnings are actionable.
- [ ] Verify with `pnpm check`, `pnpm lint`, `pnpm build`, and affected visual stories.
