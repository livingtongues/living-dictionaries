# Dict home: domains + how-to-cite layout

Semantic domains panel max ~650px (`40.625rem`). Domains left / how-to-cite right at 50/50 when the row is wide enough that half ≥ 650px; otherwise domains on top, cite full-width below.

## Plan
- [x] Pair `DomainsPanel` + cite in one container-query grid on `/home`
- [x] Cap domains at `40.625rem`; side-by-side at `@container (min-width: 81.25rem)`
- [x] Leave nudge as its own block below (no longer paired with cite)
- [x] Verify with svelte-look (LoadedStats 1024 stacked + 1600 side-by-side)

## Notes
- Wrapper `.domains-cite-wrap` owns `container-type` — an element can't `@container`-query itself.
- LoadedStats story viewports: 1024 (stack) + 1600 (50/50).
