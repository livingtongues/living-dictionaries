# Measuring what STOPPED — the zero-logins alarm and the class of bug it catches

*Established 2026-08-04 from the thirty-day Google sign-in outage. Code: `build_sign_in_health` in
`log-analytics.ts`, `sign-in-alarm-cron.ts`, `routes/admin/health/SignInPanel.svelte`.*

## The story, because the shape of it is the lesson

On 2026-07-04, commit `f5053be1` added `script.crossOrigin = 'anonymous'` to the shared third-party
script loader. `accounts.google.com/gsi/client` sends no `Access-Control-Allow-Origin`, so the script
never loaded, the Google button never rendered, and the sign-in dialog showed an orphaned "OR"
divider. **Nothing threw. No error reached telemetry.**

It stayed broken for **thirty days**, carrying 83% of the site's logins. When it was fixed on
2026-08-03, the first day back produced **23 of 23 logins and 7 new accounts** against a July median
of 2 — i.e. the broken button had been suppressing growth, not merely annoying people.

Eight consecutive nightly reviews carried the recommendation that broke it, and each night verified
that it *had been applied*. **None verified that signing in still worked.**

## The generalisable rule

> When a change touches how a **third-party integration loads**, the acceptance test is that
> integration's own success metric — *are people still signing in with Google?* — not the absence of
> new error rows. **A broken integration produces FEWER log rows, not more.**

Every other panel on `/admin/health` counts things that happened, so every one of them stayed green
for a month. A dashboard made only of counters is blind to this entire class of fault.

(Related, same family: `crossorigin="anonymous"` is a **per-origin decision verified against that
origin's real response headers**, never a blanket hardening step. It is correct on
`kit.fontawesome.com` — which returns `access-control-allow-origin: *` — and destructive on Google's.)

## Why the alarm rule is shaped the way it is

- **Judged on the last COMPLETE UTC day, never "today".** The cron runs at 04:30 PT ≈ 11:30 UTC;
  "zero logins so far today" is normal at that hour on a site whose traffic is American afternoons.
  Cost: the alarm fires ~2 days after a break rather than 1. Against a 30-day blindness, that's free.
- **≥1 login on ≥5 of the previous 7 days, and exactly 0 on the judged day.** Deliberately *not*
  "fewer than usual" — a percentage threshold on a count of ~7 is a false-alarm generator, whereas a
  reliably-live method going to exactly zero for a whole day is unambiguous.
- **It re-arms, it doesn't nag.** Fire once at the start of an outage, then a weekly reminder while
  it persists, then a one-line recovery notice. The literal reading of the report ("would have fired
  every morning for a month") is thirty notifications Jacob would learn to ignore. State lives in
  `db_metadata.sign_in_alarm_state`.
- **It costs zero queries on a request path.** It reads the daily analytics CHECKPOINT file that the
  niced child already writes — a `readFileSync`. Nothing about this instrument may ever make the box
  slower; that is the standing law.

## This is a PRODUCT instrument

It exists to tell Jacob the truth about a running site. It is explicitly **not** agent-verification
tooling — the thing that failed for a month was verified, nightly, by an agent, correctly, against
the wrong question.
