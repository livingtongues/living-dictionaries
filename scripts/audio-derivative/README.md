# Audio playback derivative tooling

`mp3lad.sh` is the literal auditioned recipe reference. `audio-sample.tsv`,
`build_dash2.py`, and `dash_template.html` preserve the round-2 verification
inputs. `backfill.mjs` is resumable because it only writes deterministic `_p1`
keys; it is dry-run by default and caps to 20 keys unless told otherwise.

Run from this directory after installing `scripts/` dependencies:

```bash
node backfill.mjs --keys=audio-sample.tsv --limit=20
node backfill.mjs --keys=audio-sample.tsv --limit=20 --apply
```

Each successful write prints a `LEDGER` TSV row for applying to production
`media_objects`. The site pipeline records ledger rows itself; the standalone
mustang run deliberately keeps the DB write as a separately reviewable step.
