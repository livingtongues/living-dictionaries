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
