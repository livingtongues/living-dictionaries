---
every: 10 22 1 * *
runs_on: mustang
provider: claude
model: claude-opus-4-8
notify: poly_pings
---

Run the LD SEO/GEO discoverability audit by executing this repo's playbook end to end:
`.claude/commands/seo-review.md` in ~/code/living-dictionaries.

That command holds the full context: it crawls the priority public page-types on **production**
(`https://livingdictionaries.app`) — home, `/dictionaries`, a dictionary landing, ≥3 entry pages,
an about page — asserts the SEO invariants (title / description / canonical / JSON-LD / OG image /
indexability), benchmarks a fixed set of target queries against search + AI answer engines, ranks
the gaps by expected impact, and writes a dated digest to `.cron/seo-reviews/YYYY-MM-DD.md`.

**AUDIT-FIRST / read-only** for now — it changes no code, only reports (promote to "fix ONE
verified-green gap, uncommitted" once trusted). Runs on **mustang** because search + AI-engine
checks need clean internet. Monthly (1st, 22:10 UTC = 06:10 MYT — outside the Anthropic peak and off
the fleet's 21:00 minute). If prod is unreachable, STOP and report rather than inventing findings.
