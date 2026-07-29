# media_objects metadata backfill (2026-07-29, one-time)

Fills the `duration_ms` / `width` / `height` columns added by shared migration
`20260729_media_object_metadata.sql` for pre-existing objects, by ffprobe-ing every
original over the public media CDN (`media.livingdictionaries.app`) from a dev
machine — ffprobe reads headers via range requests, not whole files. Ongoing
uploads are covered in-app (client-declared duration at presign, sharp dims at
photo-upload, weekly sweep probe for stragglers) — this backfill is only for history.

```bash
# 1. dump the keys still missing metadata (runs a read-only query in the app container)
ssh living 'docker exec -i sveltekit_blue node' < dump-keys.js > /tmp/media-keys.json

# 2. probe them over the CDN (background it — ~1h for the full 169k first run)
node probe.mjs /tmp/media-keys.json /tmp/media-metadata.jsonl

# 3. ship results + apply (dry-run prints a plan; APPLY=1 writes in one transaction)
scp /tmp/media-metadata.jsonl living:/tmp/ && ssh living 'sudo mv /tmp/media-metadata.jsonl /opt/hosting/data/media-metadata.jsonl'
ssh living 'docker exec -i sveltekit_blue node' < apply.js                # dry run
ssh living 'docker exec -i -e APPLY=1 sveltekit_blue node' < apply.js    # write
ssh living 'sudo rm /opt/hosting/data/media-metadata.jsonl'
```
