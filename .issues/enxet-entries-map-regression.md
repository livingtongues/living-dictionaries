# Enxet entries map regression

Production `/enxet/entries` crashes after commit `a8f198a0` with:

`TypeError: (H(...) || []).map is not a function`

## Investigation and fix

- [x] Reproduce the crash in a clean headless browser against production.
- [x] Identify the source expression: commit `a8f198a0` changed `$sources` (the
  readable store value) to `sources` (the store object) before calling `.map`.
- [x] Restore `$sources` and add a non-empty readable-store filter story.
- [x] Verify:
  - `pnpm check`: 0 errors.
  - `pnpm test --run`: 281 files passed, 1 skipped; 1,982 tests passed.
  - `pnpm build`: passed.
  - `SourcesUseReadableStore` svelte-look story: rendered in light and dark.
  - Headless Chromium on local `/achi/entries`: HTTP 200, no page errors or
    relevant console errors.

## Production evidence

The deployed bundle compiles the faulty expression as:

`Object.fromEntries((H(a) || []).map(...))`

Production telemetry contains three matching error rows across two sessions on
`/enxet/entries`; one is the reported signed-in Chrome session and two are the
clean headless reproduction.
