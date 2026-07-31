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

- [x] On **tuf**, add `UPTIME_PROBE_SECRET` to the canonical Living env — DONE 2026-07-31 (tuf
      session `e9cb90dd`): verified identical to house's value, appended to
      `secrets-decrypted/sveltekit-living.env`, `bin/sync living --env-only`, blue/green rolling
      restart (green → healthz → blue, no downtime), both containers verified via printenv.
      **OUTSTANDING for Jacob:** `bin/secrets-encrypt` needs his passphrase — the plaintext env is
      ahead of the committed encrypted archive until he runs it in ~/code/vps-setup and commits.
- [x] Make a supplied-but-invalid `X-Log-Source-Secret` fail observably — 2026-07-31:
      `classify_source()` in `/api/log` now 401s when the header is supplied but mismatched OR the
      server has no secret configured (the exact 07-16 drift); no header stays anonymous client
      logging. 4 new tests in `server.test.ts`. Goes live with LD's next deploy — until then the
      prober's `curl -f` still 200s.
- [x] Verified end-to-end 2026-07-31: post-restart prober run landed
      `2026-07-31T13:39:37Z source='server'` (ttfb 1144ms, ok). The prober's pre-fix run had logged
      its post-failure warning; post-fix run was clean.
- [x] Backfilled 2026-07-31 (Jacob-approved): scoped UPDATE (`message='uptime_probe'` +
      `vantage='mustang-my'` + `source='client'`) flipped **3,846** rows in `logs.db` and **3,386**
      in `logs-archive.db`; zero non-server probe rows remain.
- [ ] `/admin/health` shows probes after the NEXT daily analytics checkpoint (03:30 PT cron writes
      the JSON the page reads) — confirm tomorrow, then this issue can be deleted. The 401
      hardening in `/api/log` ships with the next LD deploy.
