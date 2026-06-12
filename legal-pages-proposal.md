# Proposed Legal Page Updates for Living Dictionaries

_Prepared June 12, 2026_

This note explains the proposed Terms of Use rewrite and the new Privacy Policy draft for Living Dictionaries. It is intended for Living Tongues review before adopting the new policy page publicly.

## What Changed

- Rewrote `/terms` from a long 2019 boilerplate HTML page into a shorter markdown-based Terms of Use page.
- Added a draft `/privacy-policy` page, but did not link it anywhere in the app yet.
- Removed Google Analytics from the new app shell.
- Added accurate disclosure for first-party server analytics and diagnostic logging.
- Standardized the legal/contact email on `dictionaries@livingtongues.org`.
- Kept the current live Terms page pointing to the existing external Living Tongues privacy policy until this new draft is approved.

## Why the Existing Pages Needed Work

The old Terms page appeared to come from a generic template last updated April 30, 2019. It included several clauses that did not match the app:

- Password language, even though Living Dictionaries now uses email one-time codes and optional Google sign-in.
- Mobile app, app-store, social-media-account-linking, and purchase language for features that do not exist.
- Template errors such as an unfilled copyright-agent placeholder and incorrect Delaware venue text.
- Contact mismatch between `livingtongues@gmail.com` and the app's current `dictionaries@livingtongues.org` support flow.

The bigger gap was privacy. The app linked to the Living Tongues WordPress privacy policy, which covers website comments, Gravatar, Jetpack, MailChimp, and donations, but does not explain the data practices of the Living Dictionaries web app.

## What the New Privacy Policy Covers

The draft policy covers the app behavior found in the codebase:

- Account data: email, name, avatar, auth providers, locale, unsubscribe status, and last visit.
- Sign-in: email one-time codes, Google sign-in, and a 30-day essential session cookie.
- Dictionary data: public/private dictionaries, entries, senses, sentences, texts, metadata, collaborators, roles, and invites.
- Media and speaker data: audio, photos, videos, source/photographer/videographer fields, speaker names, birth decades, gender, birthplace, and regional details.
- Support messages and inbound email attachments.
- Local-first browser storage using browser-managed SQLite/local site storage.
- First-party diagnostics and usage events stored on our own server, including errors, session starts, heartbeats, navigation events, URLs, user agent, app version, and session identifiers.
- Service providers: Google, AWS SES, Cloudflare, Mapbox, YouTube/Vimeo, and hosting infrastructure.
- Export, correction, deletion, community-content, and speaker-content requests.
- Public-content and embedded-content caveats.

## What the Terms Rewrite Preserves

The new Terms keep the important Living Dictionaries-specific protections from the old Terms:

- Community takedown rights for endangered language communities.
- Contributor responsibility for speaker, rights-holder, and community permission.
- A broad contribution license allowing Living Tongues to host, preserve, display, back up, export, and distribute contributed content.
- DMCA notice and counter-notice process, including the existing designated copyright agent details.
- Site management rights, termination rights, disclaimer, limitation of liability, indemnification, electronic communications, California complaint notice, Delaware governing law, and AAA arbitration.

The rewrite removes only the factually inapplicable boilerplate: mobile app licensing, app-store distributor terms, social-media contact-list access, and purchase/buying-agent language.

## Decisions for Living Tongues to Confirm

1. **Privacy adoption.** The new `/privacy-policy` route is currently a draft and is not linked in the app. If approved, the live Terms page should link to it instead of the external WordPress policy, and navigation/signup surfaces can link it where appropriate.
2. **Age rule.** The draft sets minimum age at 13, with under-18 users requiring parent/guardian consent. This matches COPPA language and likely classroom/community use, but Living Tongues should confirm it.
3. **Delaware law and arbitration.** The draft preserves Delaware law and AAA arbitration from the 2019 Terms, fixing only the venue/template errors. If Living Tongues wants Oregon law or a different dispute process, counsel should revise that section.
4. **Community and speaker removal process.** The privacy policy invites speakers, community members, contributors, and rights holders to request removal or restriction of content. Living Tongues should confirm the operational process for handling those requests.
5. **Retention periods.** The policy intentionally describes retention in practical terms rather than fixed day counts, because logs, backups, and dictionary sync data may vary. If Living Tongues has formal retention periods, those should be added.

## Suggested Adoption Steps

1. Have Living Tongues and counsel review `site/src/lib/legal/terms-of-use.md` and `site/src/lib/legal/privacy-policy.md`.
2. Decide whether to keep the 13+ age rule and Delaware/AAA dispute language.
3. Approve or adjust the service-provider and analytics disclosures.
4. After approval, link `/privacy-policy` from the Terms page and relevant account/sign-in surfaces.
5. Keep the policies in markdown so future legal/content edits are easy to review.

