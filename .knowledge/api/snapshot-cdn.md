# Snapshot CDN cache rule

The public dictionary snapshots use the dedicated R2 custom domain
`snapshots.livingdictionaries.app`. Snapshot objects carry
`Cache-Control: public, max-age=120`, but Cloudflare's zone-wide four-hour Browser Cache TTL used
to rewrite that response to `max-age=14400`. This made first-load dictionary data and agent bulk
reads up to four hours staler than the API's documented snapshot-sweep window.

The Cloudflare zone now has an additive Cache Rule scoped exactly to
`http.host eq "snapshots.livingdictionaries.app"`:

- action: `set_cache_settings`
- cache eligibility: enabled
- browser TTL: `respect_origin`
- edge TTL: `respect_origin`

Cloudflare identifiers, needed when auditing or updating the rule:

- zone: `54b5f985b206fd11c9a53bbc59d0dc24`
- `http_request_cache_settings` ruleset: `19a14f16e8464e99904a490cd8b37102`
- snapshot rule: `87006fa5505749629d1600e9d38fa3e6`

The existing sitemap/`llms.txt` cache rule remains ahead of it and is unchanged. The snapshot
hostname is dedicated to the R2 snapshot bucket, so the host-scoped rule does not affect the app,
media, or other public-cache surfaces.

Verification on 2026-07-20: a cache-busted request returned HTTP 200,
`cf-cache-status: MISS`, and `cache-control: public, max-age=120`.

```bash
curl -sSI 'https://snapshots.livingdictionaries.app/dictionaries/babanki.db.gz?cache-rule-verify=1'
```

## LD's zone has NO checked-in desired state (2026-07-29)

This page is the only record of any LD cache rule, and it covers exactly one of them. Unlike
house — whose rules live in `vps-setup/cloudflare/hvsb-cache-rules.json` and are applied by
`vps-setup/bin/cf-cache-rules` — nothing in any repo describes what LD's zone *should* look like,
so its current state is unknowable without a token. In particular the sitemap/`llms.txt` rule that
sits ahead of the snapshot rule has never been written down, and no one can tell from the repo
whether `/og`, `/api/*`, or the app HTML are cached at the edge at all.

Before writing a desired-state file, READ the live ruleset (`Zone.Cache Rules:Read`) — writing it
from this page alone would encode a guess. Scoping notes are in
`.issues/nightly-2026-07-28-approved-execution.md`.
