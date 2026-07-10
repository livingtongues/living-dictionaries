# Standing decisions — living-dictionaries log-review

Durable Jacob decisions this lane must honor. **Read this FIRST, before the dated digests.**
Maintenance: dated one-liners; add on a durable debrief decision (declines, kill-list items,
standing baselines); DELETE once shipped or obsolete. Keep it small — standing law, not a log.

- **2026-07-09 — stale-client `sync_failed` storms: IGNORE.** Greg's stuck tab is a forgotten old
  laptop (he's been nudged); **no forced-reload mechanism will be built.** Stale-tab/stale-build
  retry noise is KNOWN-NOISE — filter it from triage, stop re-raising it, drop the carried
  "stale-client recovery" coverage item.
- **2026-07-07 — the conlang fork is fenced off from mission reporting.** Don't count it or
  report on it.
- **2026-07-05 — `api/email/html/new-user-welcome.ts`: KEEP** even though it's orphaned — Jacob
  is handling welcome emails separately. Not a dead-file candidate.
- **2026-07-09 — `logs.db` VACUUM-after-prune: approved & dispatched** (worker `4a4593e3`).
  Crawl-driven log growth during the SEO crawl is expected — only escalate if growth stays steep
  after the crawl settles.
- **2026-07-09 — crawler noise:** `live_query_failed` proved 98.5% Googlebot; treat crawler
  misuse / bot boot-cascade rows as known-noise pending the fleet noise-floor artifact
  (worker `74d5d94a`).
