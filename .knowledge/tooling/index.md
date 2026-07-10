# tooling/

Dev tooling that augments the app but isn't part of the shipped runtime.

- [sqlite-proxy.md](./sqlite-proxy.md) — dev-only HTTP+WS proxy + `live_share` + `sqlite-query.sh`
  for running SQL against the live browser wa-sqlite DBs (admin `shared.db` + per-dict `dict.db`).
  Shared pattern with house/tutor; LD's multi-target/composite-client + write-aware specifics.
- [pwa-icon-generation.md](./pwa-icon-generation.md) — generating manifest/PWA icon PNGs
  without ImageMagick/sharp (puppeteer-core + local Chromium screenshot trick), and the
  Android maskable-icon fix (full-bleed art + `purpose: "any maskable"`).
- [test-suite-performance.md](./test-suite-performance.md) — the 2026-07 commit-gate speedup:
  serialized-template DB opens (`open_test_shared_db` + the template inside
  `open_dictionary_db_in_memory`) and the `vitest run --changed` pre-commit hook with its `.sql`
  full-run fallback. LD-specific numbers + the `--changed` blind-spot analysis.
