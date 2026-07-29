# Fan-out verification lanes — the two ways they lie to you

Learned from the **Ponca import, round-3 vision audit** (2026-07-28): ~14 parallel agent lanes were
each handed ~20 printed book pages and told to compare the scanned image against the parser's
`expected/pNNN.md` output, writing one findings JSON per page. Recovery is written up in
`.issues/ponca-audit-round-3-lane-recovery.md`; this page is the durable lesson.

A fan-out lane reports "done" in two different false ways. **Neither is visible from the
orchestrator's side without an artifact gate**, because a lane that stops answering and a lane that
answers wrongly look identical in `horse list`.

## Failure 1 — the lane just stops (subscription session limit)

Lanes died mid-page with `You've hit your session limit · resets 4:40am (UTC)` as their final
assistant message. Three of the four largest Ponca transcripts ended exactly this way, and **18 of
the 114 Living Dictionaries sessions in the 2026-07-27→28 window** hit the same wall.

- It is a **shared, account-wide budget**, so a wide Claude fan-out competes with itself — the more
  lanes you open, the sooner they all stop.
- The stalled process **cannot be resumed**; you get a new lane or nothing.
- **Cross-provider replacement works and is the cheapest fix.** Every stalled Claude lane in round 3
  was finished by a **Codex** replacement lane, which draws on a different subscription. When a
  Claude fan-out stalls on quota, respawn the tail of the work on Codex rather than waiting for the
  reset.
- Corollary for planning: **make lane work resumable at a small unit.** One JSON per page meant a
  replacement lane only had to redo the pages with no artifact, not the lane.

## Failure 2 — the lane completes, but skipped the comparison

Worse, and silent. Three lanes (pages 141–160, 201–220, 221–241) wrote full, schema-valid,
`checked: true` findings for every assigned page **without ever reading the `expected/` file** —
they looked at the image and compared it against their own assumptions of what the parser
would have produced. Their output was confidently clean and completely worthless; all three lanes
had to be redone from scratch.

- The prompt already said "do not skim". Instruction strength did not prevent it.
- What caught it was **reading the lane's transcript for the required tool call**, not reading its
  output. A lane's artifact cannot testify to its own provenance.

## The gate that actually works

Before an orchestrator triages fan-out results, verify per assigned unit:

1. **Coverage** — an artifact exists for every assigned unit, and no extras.
2. **Validity** — each artifact parses and carries the explicit completion marker (`checked: true`).
3. **Provenance** — the lane's transcript contains the evidence read it was supposed to perform
   (here: a `Read` of `expected/pNNN.md` for each page). This is the check that catches Failure 2.

Coverage + validity alone pass a lying lane. Provenance is the non-optional third leg.
