# Ponca import — shareable HTML process report for the other admins

Jacob asked (2026-07-31) for a standalone HTML report he can send to the other Living Dictionaries
admins explaining how the Ponca import actually went: every conversation turn from him and from the
agents, one-line summaries of what each agent did, where lanes were spawned and what each was
assigned, clear timestamps + durations, and the site-code pauses called out in an offset colour.

## Deliverable — ✅ DONE

`/home/jacob/reports/ponca-import-process.html` — single self-contained file, 81 KB, no external
assets, prints cleanly, responsive to 420px. Verified headless (0 page errors, no horizontal
overflow on mobile) and eyeballed at five scroll positions.

Colour system: amber = Jacob · blue = driver agent · teal = lane fan-out · **rose + indented** =
site-code pause (the "offset colour" he asked for) · purple = agent↔agent message · red = the
usage-limit interruption. Model chips are colour-coded (sol teal / opus purple / fable blue /
sonnet sky).

Deliberately avoided emoji/dingbat glyphs — mustang has no emoji font and the report may be read
anywhere, so markers are CSS elements and ✅/❌/💡 were replaced with styled text.

## How the source data was assembled (reusable recipe)

1. Scanned all 574 session JSONLs in `~/.claude/projects/-home-jacob-code-living-dictionaries/`
   counting `ponca|ponka` hits in **user messages only** → 101 sessions.
   - GOTCHA: the recovery orchestrator `019fa700` never says "ponca" in a user message; it was
     found by scanning the 04:00–04:40 window on 07-28. Text-matching alone under-counts.
2. **Model/provider attribution comes from the sibling `<session-id>.meta.json`** files
   (`driver_kind`, `model`, `effort`, `display_name`) — the JSONL itself carries no model field for
   codex sessions. This is the only reliable way to say which model a lane ran on.
3. `nuser` from the JSONL over-counts humans: image reads and `<task-notification>` blocks land as
   `type:"user"`. Filter out `[Image:`, `<task-notification>`, and bare `Continue`/`continue`/
   `finish up` to get Jacob's real turns → **31 across the whole run**.
4. Lane prompts wrap at ~90 cols, so substring matching on a lane-kind marker breaks across a
   newline (`FRONT/BACK\nMATTER`). Normalise whitespace before classifying.

Scratch scripts used are in `/tmp/ponca-report/` (`inv2.py` builds `sessions.json`, `x.py` extracts
one session as timestamped user/AI turns + tool markers). Not worth keeping in the repo.

## The numbers the report asserts (all verified)

| | |
|---|---|
| Sessions | 101 (70 vision lanes · 14 drivers · 8 recovery · 6 named lanes · 3 feature lanes) |
| Lanes spawned | 87, across 8 fan-outs |
| Jacob's turns | 31 (7 + 17 + 7 by day) |
| Wall clock | 07-27 08:07 → 07-29 11:10 UTC · 4h58m + 9h23m + 9h29m |
| Site-code pauses | 8, commits `02a0c3bb 059c9143 0a15a118 97444112 a81734e2 14c684e6 b16040f3 72dca5ea` (~220 files, +12,972/−1,083; two of them also carry unrelated work) |
| Final prod state | 5,257 entries · 5,617 senses · 199 sentences · 68 grammar sections · 67 glossing codes · 8 clause slots · 668 relationships · 38 review flags · 3 open questions · 1 message |

Prod state re-queried live on 2026-07-31 via `ssh living 'docker exec -i sveltekit_blue node'`.
