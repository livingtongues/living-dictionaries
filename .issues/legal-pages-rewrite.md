# Legal pages rewrite: TOS + new Privacy Policy proposal

## Decisions (from Jacob, 2026-06-12)
- **TOS**: full rewrite at `/terms` in house's plain-language markdown style, BUT preserve all
  substantive legal protections (Greg's brother, a lawyer, likely shaped the originals) — keep the
  full Dispute Resolution section (Delaware law, AAA arbitration, fix venue to "Kent County,
  Delaware"), Disclaimer, Limitations of Liability, Indemnification, etc. Delete only the
  factually-inapplicable boilerplate (mobile app license, social-media account linking, purchases).
  Keep bespoke LD clauses: community content takedown rights, contribution license, DMCA process.
- **Privacy Policy**: create `/privacy-policy` route but **link it NOWHERE** — it's a proposal
  Jacob will pass to Anna (Living Tongues) to adopt. Content from: code reality + house's policy +
  best practices + the good parts of livingtongues.org's WP policy (rights/export/erase, embedded
  content).
- **Google Analytics**: REMOVE gtag from `site/src/app.html` (new version won't have it).
  Both LD and house keep/will-keep first-party self-hosted analytics — disclose that in BOTH
  privacy policies (edit house's `site/src/lib/legal/privacy-policy.md` too).
- **Age**: 13+, under-18 with guardian consent (was 18+; Jacob saw recommendation, didn't object —
  FLAGGED in the proposal doc for Anna to confirm).
- **Routes**: keep `/terms`, add `/privacy-policy`.
- **Contact**: standardize on dictionaries@livingtongues.org (TOS had livingtongues@gmail.com).
- Live TOS keeps linking the external livingtongues.org privacy policy until Anna adopts the new
  one (since /privacy-policy must stay unlinked for now).
- Deliverable: explanation markdown for Anna at repo root `legal-pages-proposal.md`.

## Audit findings (for reference)
- No LD privacy policy exists; external WP policy covers only blog comments/Jetpack/MailChimp/donations.
- TOS (Termly boilerplate, Apr 2019) errors: unfilled `[us/our Designated Copyright Agent]`,
  "United States County, Delaware", "Kent County County", "one (1) years", "determined to by",
  "the the Uniform", password language (app has no passwords — OTP + Google One Tap),
  mobile-app + social-media + purchases sections describe nonexistent features,
  contact email mismatch, 18+ vs COPPA contradiction.
- Actual practices to disclose: session JWT cookie 30d, email-OTP via SES, Google One Tap,
  speaker personal data (name/birth decade/gender), public contributions, OPFS local DB,
  GCS/lh3 media, R2 attachments+snapshots, Cloudflare inbound email, Mapbox tiles (IP),
  YouTube/Vimeo embeds, client_logs telemetry (remote-log.ts), server request logs.

## Tasks
(NOTE: prior session pre-checked everything then died to a content filter right after the
app.html edit — only the first three were actually done. Resumed 2026-06-12.)
- ✅ Audit + decisions
- ✅ Remove gtag from site/src/app.html
- ✅ Add `marked` dep to LD site
- ✅ `$lib/legal/terms-of-use.md` (rewrite) + `$lib/legal/privacy-policy.md` (new)
- ✅ `$lib/components/LegalPage.svelte` (house typography, LD theme vars, direction:ltr)
- ✅ Rewrite `/terms/+page.svelte`; add `/privacy-policy/+page.svelte` (unlinked)
- ✅ en.json: add `terms.privacy_policy` key
- ✅ House: amend privacy-policy.md for first-party self-hosted analytics
- ✅ Write `legal-pages-proposal.md` for Anna
- ✅ Verify: pnpm check + browser screenshots of both pages (dev port 3041)

## Implementation notes (2026-06-12)
- `/privacy-policy` exists only as a direct route. It is intentionally not linked from Terms,
  SideMenu, Header/Footer, AuthModal, create-dictionary, or invite flows.
- Live `/terms` still links to `https://livingtongues.org/privacy-policy/` until Living Tongues
  adopts the proposed policy.
- `site/package.json` / `pnpm-lock.yaml` were already dirty from concurrent Uno-removal work; this
  task relies only on the `marked` dependency that was added by the prior legal-page attempt.
- `pnpm --filter site check`: passed with 0 errors, 19 existing warnings.
- Browser verification on `http://localhost:3041/terms` and `/privacy-policy`: desktop + mobile
  render, expected h1s, expected section counts, no horizontal overflow, no page errors. Ignored
  known Google One Tap/FedCM console noise emitted by the shared logged-out header.

## Facts gathered for content (verified in code 2026-06-12)
- users table: id, email, name, avatar_url, providers (json), unsubscribed_from_emails,
  preferred_locale, last_visit_at, created_at, updated_at
- Auth: email OTP (email_codes, SES) + Google One Tap; `session` httpOnly JWT cookie, 30d
- Telemetry: remote-log.ts → client_logs (errors, session_start/heartbeat, navigation events,
  url, user_agent, app_version, session_id). NO GA/Sentry. + standard server request logs.
- Hosting: Hostinger VPS, US (EST reboot window) — "hosted in the United States" stands
- Contact email: dictionaries@livingtongues.org (Contact.svelte, addresses.ts)
- DMCA agent: Jonathan Anderson, 4676 Commercial St SE #454, Salem OR 97302
- Third parties: Google (sign-in, GCS/lh3 media), Mapbox (tiles→IP), YouTube/Vimeo embeds,
  AWS SES (email out), Cloudflare (R2 attachments + inbound email routing)
- i18n: English is fallback for missing keys → safe to add key to en.json only
- LD theme has `--primary` (blue) — use it in LegalPage instead of house's hardcoded #2563eb
- House repo has one unrelated dirty file; editing its privacy-policy.md is safe
