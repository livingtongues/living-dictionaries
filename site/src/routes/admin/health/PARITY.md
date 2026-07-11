# Deploys panel — cross-repo parity manifest

The VPS deploy-metrics panel is copy-paste-shared across **tutor**, **house**, and
**living-dictionaries** — this file is kept identical in all three. Unlike the email components,
these two files ARE byte-identical on purpose (nothing app-specific lives in them): use this
manifest so an accidental edit in one repo gets mirrored, not forked.

## Must stay byte-identical (all three)

- `site/src/routes/admin/health/DeploysPanel.svelte` — renders the "Deploys" panel on
  `/admin/health` (per-deploy stacked-phase bar chart + recent-deploys table).
- `site/src/lib/db/server/deploy-metrics.ts` — reads/parses `<DATA_DIR>/deploy-metrics.jsonl`
  (one line per finished VPS deploy, appended by the instrumented `deploy.sh` generated in
  vps-setup `bin/sync`) into the `DeployMetric[]` the panel consumes.

## Rule

Any change to either file — a new phase key, a chart tweak, a parser fix — MUST be mirrored into
**all three** repos in the same lockstep. Keep them byte-identical; if an app genuinely needs to
diverge, record the fork here first (as the email-components manifest does) so drift stays
intentional.
