# Restore the synthetic uptime feed

Production review on 2026-07-30 found that the external Mustang prober is running, but
`/admin/health` cannot see any of its samples:

- `logs.db` contains **3,903 `uptime_probe` rows** from 2026-07-16 through 2026-07-30.
- Every row has `source='client'`; zero have `source='server'`.
- `build_uptime()` correctly requires `source='server'`, so the 2026-07-30 analytics checkpoint
  reports `uptime.probes = 0`.
- The prober sends `X-Log-Source-Secret: $UPTIME_PROBE_SECRET`, while the Living production
  container has no `UPTIME_PROBE_SECRET`. `/api/log` therefore treats the request as an anonymous
  client log and returns HTTP 200, so the prober has no indication that trusted ingestion failed.
- The raw 24-hour feed still contained 265 samples (256 successful), proving this is attribution,
  not a stopped prober.

## Repair

- [ ] On **tuf**, add the same `UPTIME_PROBE_SECRET` used by the Mustang prober/house to the
      canonical Living environment file, then run `vps-setup/bin/sync living --env-only` and restart
      or deploy Living.
- [ ] Make a supplied-but-invalid `X-Log-Source-Secret` fail observably (for example HTTP 401),
      while requests with no header remain valid anonymous client logging. This lets the prober's
      existing `curl -f` warning catch future secret drift.
- [ ] Verify the next `uptime_probe` row has `source='server'`, then recompute or wait for the next
      daily analytics checkpoint and confirm `/admin/health` shows probes again.
- [ ] Decide whether to backfill the existing unmistakable Mustang rows
      (`message='uptime_probe'`, `context.vantage='mustang-my'`) to `source='server'`; otherwise the
      panel will rebuild history naturally as the 14-day hot window advances.
