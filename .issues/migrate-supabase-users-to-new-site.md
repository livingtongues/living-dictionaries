# Day-of: migrate Supabase users to new-site auth

One-time cutover that moves the production userbase from old-site (Supabase Auth) into new-site (`shared.db.users` + email-OTP/Google-OneTap JWT auth). Runs once, on flip-over day, when new-site is feature-complete enough to replace old-site.

**Strategy chosen (Q2/option-a):** Build new-site auth fresh against an empty `shared.db.users` while old-site stays in production. On flip-over day, run a one-time script that exports Supabase `auth.users` → inserts into new-site `users` table preserving UUIDs. All existing `created_by` / FK references stay valid because IDs are stable.

---

## Pre-migration prep (done before flip-over day)

- [ ] New-site auth fully built + tested (this is the work being done now in `.issues/port-auth-from-house.md` or wherever).
- [ ] New-site has a `users` table whose `id` column accepts Supabase UUIDs (UUID string PK, no auto-generated alternative).
- [ ] New-site feature parity sufficient to replace old-site for end users.

## Data export from Supabase

- [ ] Pull Supabase `auth.users` (id, email, created_at, raw_user_meta_data, raw_app_meta_data) via `pg_dump` or admin API. Reference: existing `packages/scripts/` for shape.
- [ ] Pull Supabase `user_data` (or whatever holds extended profile — avatar, locale, etc. — check `packages/old-site/src/lib/supabase/user.ts`).
- [ ] Other Supabase tables to migrate (see `.issues/port-db-sync-architecture.md` for the full target schema):
  - **Into `shared.db`**: `dictionaries` catalog, `dictionary_roles`, `invites`.
  - **Into `dictionaries/{id}.db` × N (one file per dictionary)**: `entries`, `senses`, `sentences`, `senses_in_sentences`, `audio`, `audio_speakers`, `speakers`, `videos`, `video_speakers`, `sense_videos`, `sentence_videos`, `photos`, `sense_photos`, `sentence_photos`, `tags`, `dialects`, `entry_tags`, `entry_dialects`.
  - **Junction tables**: legacy uses composite PKs; new sqlite uses synthetic UUID + UNIQUE on natural key (Q8 decision). Migration script generates UUID v7 for each junction row.
  - **Soft-delete**: legacy `deleted TIMESTAMP` column carries over verbatim (Q5 decision — sync-vehicle `deletes` table semantics preserved).

## Data import to new site

- [ ] Map each Supabase user → `shared.db.users` row. Decisions to record here as we make them in the auth interview:
  - [x] `app_metadata.admin` (0/1/2 — no 3 actually used in code) → `users.admin_level INTEGER NOT NULL DEFAULT 0`. Verbatim copy. Levels: 0 = regular user, 1 = editor admin, 2 = super-user/dev admin. Decision recorded in auth interview Q3.
  - [ ] How `user_metadata.full_name`, `user_metadata.avatar_url`, `user_metadata.preferred_locale` (or wherever they live) map onto new-site columns.
  - [ ] Whether to populate `users.providers` JSON with `{ provider: 'google', provider_id: <google_sub> }` for users known to have signed up via Google (so their first new-site Google login matches by provider, not just by email).
  - [ ] Whether to populate `users.providers` with `{ provider: 'email', provider_id: <email> }` for everyone so OTP login matches by provider not just by email-fallback.

## Email provider continuity

- [ ] Reuse existing AWS SES setup. New-site VPS needs `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_REGION`, `AWS_SES_SECRET_ACCESS_KEY` (same values currently in old-site's `.env`).
- [ ] Sender remains `no-reply@livingdictionaries.app` (already SES-verified, already in legacy `addresses.ts`).
- [ ] Confirm SES sending domain is verified for the new-site VPS's IP range too if there's IP restriction (likely no, but worth a one-line check).

## Auth provider continuity

- [x] **Google OAuth client_id decision**: reuse legacy `215143435444-fugm4gpav71r3l89n6i0iath4m436qnv.apps.googleusercontent.com`. Users' Google `sub` values stay stable → first Google sign-in on new-site is a direct `provider_id` match against their migrated `users.providers` entry. (Confirmed in auth interview Q6.)
- [ ] **Before flip-over day**: add new-site's production origin(s) to **Authorized JavaScript Origins** in Google Cloud Console for this client_id. Already-listed legacy origins stay (old-site keeps working until DNS cuts over).
- [ ] **New-site `.env`**: set `PUBLIC_GOOGLE_OAUTH_CLIENT_ID=215143435444-fugm4gpav71r3l89n6i0iath4m436qnv.apps.googleusercontent.com`.
- [ ] **In migration script**: when populating `users.providers`, write `{ provider: 'google', provider_id: <google_sub_from_supabase_identities> }` for any Supabase identity row with `provider='google'`. Source the `provider_id` from `auth.users.identities.id` (Supabase stores the Google `sub` there). Quick verification needed at script-write time — confirm Supabase's `identities` table holds the raw Google `sub` and isn't UUID-wrapped.

## User communications

- [ ] Email blast to all users explaining the change (likely: "we've upgraded — sign in the same way with the same email, your data is unchanged").
- [ ] Decide whether to invalidate Supabase sessions at cutover or let them naturally expire.

## DNS / traffic cutover

- [ ] (TBD) Which subdomain serves new-site at flip-over.
- [ ] (TBD) How long old-site stays available read-only as a fallback.

## Post-migration verification

- [ ] Spot-check N production users can log in via email-OTP and land on existing data.
- [ ] Spot-check Google sign-in matches the right user row.
- [ ] Verify admin users still see admin UI.
- [ ] Verify FK integrity: no orphaned `created_by` references after the import.

---

This file gets populated continuously during the auth-port interview. Every architectural decision that affects what data needs to come over from Supabase, or what shape it lands in, adds a row to one of the lists above.
