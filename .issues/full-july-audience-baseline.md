# Full-July audience baseline (cron `c-d0fe4e`, approved 2026-07-21 debrief)

**Assignment** (from `horse/.cron/overnight-briefs/2026-07-21.md` debrief agenda + the backlog line in
the recovered `business-reviews/living-dictionaries-2026-07-21.md`):

> Bank July as the audience baseline after the month closes: report public corpus production
> (221 dictionaries · 270,153 entries) alongside reach (true unique visitors and anonymous share),
> keeping conlang/glossary traffic separate from mission reporting.

Constraints: read-only production. No product-code mutation. No user contact.

## Provenance note
The prompt cited `horse/.cron/business-reviews/living-dictionaries-2026-07-21.md`, which was **deleted
by a retention sweep** in horse commit `6411b12`. Recovered read-only via
`git show 6411b12^:.cron/business-reviews/living-dictionaries-2026-07-21.md`.

## Key finding driving method: the stored July row was NOT a complete July
- `dictionary_monthly_visitors` month windows are **UTC** (`YYYY-MM-01T00:00:00.000Z` → next month).
- `rollup_recent_months` recomputes non-finalized months, then advances
  `monthly_visitors_finalized_through` to the month BEFORE the current one → **July freezes on the
  first August sweep**.
- Retention cron = daily **03:30 America/Los_Angeles** (`crons.ts`), last run
  **2026-07-31T10:30:00Z**. At the time of this task (2026-08-01 09:00 UTC / 02:00 PT) the Aug-1
  sweep had NOT yet run.
- Therefore the stored July row (14,706 visits / 7,219 visitors / 6,223 anon) covered only
  **2026-07-01T00:00Z → 2026-07-31T10:30Z**, missing July's last ~13.5 h, and
  `monthly_visitors_finalized_through` was still `2026-06`.
- **14,105 raw `client_logs` rows exist in that untallied tail** — real, uncounted July activity.
- The 2026-07-31 review (run 10) called July "now a **complete** month" while reading this same
  stale row. That claim was premature; correcting it is the point of this baseline. ✅ diagnosed

## Method
Waited for the 2026-08-01 03:30 PT sweep to roll complete days → recompute July from raw → freeze it,
then read the frozen row. Chosen over reimplementing the bot classifier read-only (zero divergence
risk, uses production code, no mutation by me). Raw coverage verified complete for July:
archive `logs-archive.db` 2026-06-26 → 2026-07-17T10:29Z, hot `logs.db` 2026-07-17T10:30Z → now.

## Steps
- ✅ Recover the 07-21 review + confirm the approved scope
- ✅ Establish rollup timezone/freeze semantics from code
- ✅ Prove the stored July row was partial; verify raw July coverage
- ✅ Corpus production by bucket (mission vs conlang/glossary)
- ✅ Per-bucket audience segmentation
- ✅ Read frozen July `__site__` row after the sweep
- ✅ Validity screen on comparisons (June invalid)
- ✅ Write durable review artifact + report to Jacob

## DONE — 2026-08-01. Outcome

The Aug-1 sweep ran at **2026-08-01T10:30:00.756Z** and froze July
(`monthly_visitors_finalized_through = 2026-07`). Baseline read from the frozen row.

**Second trap found:** `visitor_id` only shipped mid-2026-07-07; before it `rollup_month` falls back to
`visitor_id ?? session_id`, so 07-01→07-07 "visitors" are session-keyed. Tell: daily
`visitors == sessions` exactly while the id is missing. So full-July is an upper bound.

| July 2026, site-wide | Full month (frozen) | Device-keyed 07-08→07-31 |
|---|---:|---:|
| Unique visitors | 7,332 | **5,182** |
| Visits | 14,945 | 12,318 |
| Anonymous | 6,334 (86%) | **5,012 (97%)** |
| Signed-in | 998 (artifact) | **170** (≈163 real users ✔) |

- **Mission (public+unlisted)** drew **4,048** of 4,403 dictionary-openers = **91.9%**;
  conlang+glossary 365; overlap only 23. Fence is clean.
- **Corpus stock:** public 221 dicts · 273,581 entries; platform 1,296 · 590,091.
- **July production (flow):** mission 28,652 (public 3,832/11 dicts, unlisted 24,820/30);
  conlang 1,328; glossary 79; `river` 15,254 (internal test, excluded). Platform 45,329.
- **92.7% of mission production was Jacob (21,825) or PT Anderson/LT staff (4,728); 7.3% (2,099)
  independent curators.** Content-layer twin of run 10's "no outside API key has ever fired."
- **Zero dictionaries went public in July**; 61% of the 64 new dicts were conlang/glossary.

**Method note (reusable):** rather than reimplementing the rollup, the read-only port of
`rollup_month()` was validated by reproducing the official `__site__` row **to the digit, twice** —
pre-sweep (14,706/7,219/6,223 at the last-sweep cutoff) and post-freeze (14,945/7,332/6,334). Scripts
in `/tmp/julybase/` (throwaway). Only then were bucket-level UNIONs trusted.

## Deliverables
- `horse/.cron/business-reviews/living-dictionaries-2026-08-01.md` — the durable review artifact
- `horse/.cron/business-reviews/living-dictionaries-profile.md` — stale audience note replaced
- `.knowledge/admin/analytics-telemetry.md` — "Reading a MONTH out of this table — two traps"

No product code touched, nothing committed, no user contacted. (Other uncommitted LD files on
2026-08-01 belong to the concurrent nightly lane, `.issues/nightly-fixes-2026-08-01.md` — not this work.)

## Open follow-up
Re-baseline in early September (Aug is the first fully device-keyed month; Aug→Sep is the first
legitimate month-over-month). Not scheduled — proposed to Jacob in the report.
