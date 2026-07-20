---
every: 10 22 15 * *
runs_on: mustang
provider: codex
model: gpt-5.6-sol
notify: poly_pings
---

Run the LD v1 API product-contract-conformance audit by executing this repo's playbook end to end:
`.claude/commands/api-conformance-review.md` in ~/code/living-dictionaries.

That command holds the full context: it gates on `src/lib/api/v1/openapi.test.ts` being green, then
reconciles the published OpenAPI contract (`$lib/api/v1/openapi.ts` → `/api/v1/openapi.json`) against
the actual `/api/v1/**` route handlers, the `*-input.ts` validators, the shared write helpers, and
the per-route enforcement tests — building a requirement ledger (proved / weak / contradicted /
unimplemented), ranking confirmed code↔spec mismatches by agent-facing impact, and writing a dated
digest to `.cron/api-conformance-reviews/YYYY-MM-DD.md`.

**AUDIT-FIRST / read-only** for now (promote to "fix ONE confirmed mismatch + regression test,
uncommitted" once trusted). **Non-goal:** never edit the spec's DESIGN — reconcile code → contract,
report genuine spec bugs. Monthly on the 15th (22:10 UTC = 06:10 MYT — off-peak, off the fleet's
21:00 minute); also worth a manual `horse cron run` right after a v1 milestone lands. Runs on mustang
alongside the other LD lanes.
