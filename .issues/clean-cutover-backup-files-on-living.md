# Clean up cutover/squash backup DB files on the living VPS

The Supabase→SQLite cutover and the pre-cutover migration-squash left a set of safety-backup DB
copies in `/opt/hosting/data` on the **living** VPS. They're no longer load-bearing now that the
cutover has settled (DNS flipped 2026-07-03, +1d grace watch clean 2026-07-04) — deleting them
reclaims ~250 MB. **Hold until Jacob is confident we won't need a rollback**, then remove.

## Files (as of 2026-07-04) — READ-ONLY inventory, do NOT auto-delete

| File | Size | Origin |
|---|---|---|
| `dictionaries/river.db.bak-2026-07-02T02-56-52-813Z` | 19M | pre-migration river backup |
| `dictionaries/river.db.bak-squash-20260702-111915` | 30M | migration-squash backup |
| `dictionaries/river.history.db.bak-squash-20260702-111915` | 63M | migration-squash backup |
| `shared.db.bak-20260629-113258` | 1.4M | routine pre-change backup |
| `shared.db.bak-20260701-023907` | 5.8M | routine pre-change backup |
| `shared.db.bak-20260701-095725` | 6.5M | routine pre-change backup |
| `shared.db.bak-20260703-125623` | 66M | Phase-B push backup |
| `shared.db.bak-phaseB-20260703-021209` | 23M | Phase-B delta backup |
| `shared.db.bak-precutover-20260702-234622` | 16M | Phase-A push backup |
| `shared.db.bak-squash-20260702-111915` | 16M | migration-squash backup |
| `shared.db.old-river-only` | 16M | pre-migration river-only shared.db |

## When ready (Jacob's go-ahead)

```bash
ssh living 'rm -i /opt/hosting/data/*.bak-* /opt/hosting/data/shared.db.old-river-only \
  /opt/hosting/data/dictionaries/*.bak-*'
```

Keep the newest `shared.db.bak-*` (the Phase-B push backup, `20260703-125623`) a while longer if
any doubt remains — it's the last-known-good pre-flip snapshot. Never touch the live
`shared.db` / `dictionaries/*.db` (no `-bak`/`-old` suffix).
