# Snapshot edge cache serves 4h TTL instead of the documented/intended 120s

Source: agent feedback thread `df173af2-605d-4f75-84c2-1026b1b2e86e` (文山话 / Poly Tutor importer,
2026-07-18, finding 3; marked resolved 2026-07-19). **Jacob decision: fix the edge, keep the docs'
120s promise.**

## Verified problem (2026-07-19)

- Origin intent: `r2-snapshot-builder.ts:252` uploads every snapshot with
  `CacheControl: 'public, max-age=120'`; docs (openapi + landing) promise `max-age=120` /
  ~30-min worst-case staleness.
- Live reality: `curl -sI https://snapshots.livingdictionaries.app/dictionaries/babanki.db.gz` →
  `cache-control: public, max-age=14400` even on `cf-cache-status: MISS`. Cloudflare rewrites the
  browser-facing header — 14400s = 4h = the CF **zone default Browser Cache TTL**, which overrides
  the R2 object's own Cache-Control on the custom domain.
- Impact: importers see snapshot-sweep + up to 4h staleness (the Tutor importer built a cache-buster
  workaround); AND the app's own first-visit dict boot (`fetch-snapshot.ts`, which documents "2-min
  CDN cache") can serve data up to ~4h stale.

## Fix

In the Cloudflare zone for `livingdictionaries.app` (dashboard — this is NOT managed in vps-setup;
check for a CF API token in `vps-setup/secrets-decrypted/` first, else it's a manual dashboard change):

1. Create a **Cache Rule** scoped to hostname `snapshots.livingdictionaries.app`:
   - **Browser TTL: Respect origin** (origin sends 120s on every object).
   - **Edge TTL: Respect origin** (or explicit 120s) — so the edge itself also revalidates within
     ~2 min, honoring the promise end-to-end.
2. Verify: `curl -sI …/babanki.db.gz` shows `cache-control: public, max-age=120`; re-request after an
   edit + sweep shows fresh content within the promised window (or at minimum a young `age`).
3. Check nothing else rides that hostname (it's snapshot-only) so the rule can't over-apply.

## Follow-through

- If a CF API token with zone Rules permission exists, script it and note the rule id; otherwise
  document the manual rule (screenshot/desc) so it survives audits.
- Write a short `.knowledge/` note (e.g. `.knowledge/api/snapshot-cdn.md` or fold into the existing
  snapshot knowledge): the zone-default Browser Cache TTL override gotcha, the rule that fixes it,
  and the verification curl. Cross-link from `.issues/v1-api-quick-wins.md` §11 (snapshot guide
  should state the now-true 120s).
- Sanity-check other public-cache surfaces on the zone for the same override (e.g. anything else
  served via R2 custom domains); note findings.
