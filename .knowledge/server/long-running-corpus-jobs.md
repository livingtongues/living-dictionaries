# Long-running one-off corpus jobs — how to run a 13-hour media pass

*Written 2026-08-04 from the audio-derivative corpus backfill: 146,997 R2 audio objects
transcoded to `_p1.mp3` playback derivatives over 12h52m on mustang. This is about **one-off
operator jobs**, not the in-app cron children — those are
[forked-child-jobs.md](./forked-child-jobs.md).*

## Never run it as a child of the agent session

Run 1 died silently at 1.5% after 12 minutes. Nothing was wrong with the job: no failures, no
stderr, no OOM. The horse session was aborted, and `abortChildProcess` killed the whole process
group with it. A `nohup`/`&` background child is still in that group.

Use a **detached transient systemd user unit** (mustang has `Linger=yes`, so user units survive
logout):

```bash
systemd-run --user --unit=<name> --working-directory=<dir> \
  --property=EnvironmentFile=<creds.env> \
  --property=StandardOutput=append:<run.log> \
  --property=StandardError=append:<run.err> \
  --property=Nice=19 \
  --property=Restart=on-failure --property=RestartSec=60 \
  --property=StartLimitBurst=100 --property=StartLimitIntervalSec=0 \
  node job.mjs …
```

`Restart=on-failure` is only safe because the job is resumable (below). Run 2 needed zero
restarts, but the property costs nothing and converts a 3am crash into a 60-second gap instead of
an idle box until the next follow-up cron.

## The log IS the checkpoint — append, never truncate

The job writes one `LEDGER\t<key>\t<bytes>\t<duration_ms>` line per success and `FAIL\t<key>\t<err>`
per failure, and takes `--resume=<that same log>`, reading it at startup to skip finished keys.
`StandardOutput=append:` points at the same file. Three consequences worth keeping:

- One log accumulates across every restart and across separate runs, and is the **single input**
  to the apply step. Run 1's 2,210 completed keys were picked up by run 2 for free.
- Restarts are idempotent and cost only the handful of in-flight encodes.
- **The progress denominator after a resume is the resumed queue, not the corpus** — run 2's
  `DONE 143085/143085` is 146,997 minus run 1's 2,210. Don't read it as a shortfall.

Keep the worklist **out of `/tmp`** (a tmp sweep mid-run destroys it) and the prod credentials
**outside the repo** (`chmod 600`); delete them when the tail is finished.

## Budget off the sustained rate, not a burst benchmark

A 60-second `workers=6` benchmark measured **4.6/s** and predicted 8.7 hours. The sustained rate
over 13 hours was **3.1/s** — about 30% below — because the corpus is not uniform: clip lengths,
CDN latency and R2 PUT time all vary by dictionary. The ETA slipped ~4.5 hours, which is the
difference between "check back after lunch" and "schedule two more follow-ups".

Worth keeping from the same benchmark: `workers=6` on **2 cores** beat `workers=4` (4.6 vs 2.9/s).
The work is partly network-bound, so oversubscribing cores pays — at `nice 19` throughout.

## When failures cluster by dictionary, suspect the uploads

319 of 146,997 keys failed (0.22%), 317 with the same
`ffprobe … Failed to read frame size: Could not seek to 1026` on the output mp3, concentrated in
galadagon (177), dogon (60), dymetris (28). Read as an encoder bug for two checkpoints.

They were **44-byte header-only WAV files with zero PCM data** — failed recordings uploaded as
empty containers. ffmpeg encodes zero samples, the output has no frames, ffprobe rightly refuses
it. Eight sampled at random across five dictionaries: every one exactly 44 bytes.

> One `curl -sfL -o /dev/null -w '%{size_download}'` over a random sample of failing keys answered
> in seconds what an ffmpeg-flag investigation would have chased for an hour. **Check the input
> before blaming the transform** — and a per-dictionary skew in the failure histogram is pointing
> at the uploader, not at your pipeline.

## An orphaned object is NOT a row a user can see — join before claiming impact

The first report of this run said "~317 entries carry silently empty audio." **Wrong by two orders
of magnitude.** Joined against the dict.dbs (three ways — `audio.id`, exact `storage_path`, and
`LIKE`), **zero of the 313 empty objects had an `audio` row at all.** They were failed uploads that
left bytes in R2 without ever creating a row: unreachable by any user, and the media sweep had
already marked every one `orphaned_at`. Meanwhile exactly **6** of the 319 failures matched a live
row — and those six were precisely the non-empty files, of which 5 were genuinely user-facing (4
valid WAVs containing pure digital silence at −91.0 dB, 1 corrupt container).

> **A per-dictionary failure histogram tells you where bytes are, not what users see.** Two
> different populations live in a media bucket — objects with rows and objects without — and only a
> join distinguishes them. Do the join before you quantify user impact or ask for a decision; here
> it moved the number from 317 to 5, and the two answers deserve completely different responses.

A useful signature: galadagon had **177 empty objects against 104 real audio rows**. When a
dictionary's orphan count exceeds its live count, you are looking at a broken uploader, not broken
content.

## Deleting what you find: reuse the shipped endpoint

For the 5 real rows, the right tool was the already-deployed
`DELETE /api/v1/dictionaries/{id}/entries/{entryId}/audio/{audioId}`, called with a short-lived
admin JWT minted inside the container. That one call does six things a hand-rolled script would
have had to reproduce — `deletes` tombstone, FK cascade, dict cursor bump, history event in
`.history.db`, `mirror_dictionary_cursor` (→ R2 snapshot rebuild), and a `v1_media_deleted` event —
and a script almost certainly would have skipped the history event, making the deletion
unattributable and unrecoverable. **Prefer the endpoint over the helper, and the helper over raw
SQL.** (Container mechanics: [server-side-content-cleanup-sync.md](../db/server-side-content-cleanup-sync.md).)

For the 313 bucket-only objects, deletion needs S3 directly — and `@aws-sdk` is **bundled** into the
server build, so it is NOT requireable from `docker exec`. Signing SigV4 by hand with `node:crypto`
is ~25 lines and was the better trade than pulling R2 credentials onto a dev box: **the credential
never left the VPS.** (The VPS has neither `rclone` nor `aws` installed.) Two guards worth copying:
compute the delete set **fresh from the ledger joined against live rows** rather than from the run
log, and give every individual delete its own `HEAD` precondition so one surprising object refuses
itself instead of riding along in a batch.

## Shape of the finish

Apply the ledger to `media_objects` with an idempotent
`INSERT … ON CONFLICT(key) DO UPDATE … orphaned_at=NULL` so re-running is harmless and any row the
live post-upload ping already recorded is simply refreshed. Then verify **both ends**: a
`ebur128` probe of a few random derivative CDN urls (cache-busted) against their originals, and a
row count. Final: 146,719 variant rows, 1.93 GB for 87.6 h of audio — **6.6%** of the 29.12 GB of
originals.
