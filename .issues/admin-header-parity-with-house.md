# Admin parity with house: header, user menu, compose, chat polish — ✅ DONE 2026-07-03

Port several house admin patterns into LD (+ two fixes back into house).

## LD tasks
- ✅ Admin header: replaced `$lib/layout/UserMenu.svelte` slideover with shared `$lib/components/shell/User.svelte` (full site menu: Admin Panel, View as, Appearance, Account, Sign out, dev tools). Deleted `$lib/layout/`.
- ✅ Nav icons (house pattern, mobile icon-only + horizontal scroll since LD has 10 items): Messages (icon+text), Users (icon), Team (icon+text), Dictionaries (icon+text), Analytics (icon, NEW nav item), Schema (icon), API (icon, renamed from "Agent API"), Triage (icon), Legal (icon), Sync = SyncStatus cloud as last nav item. `SyncStatus.svelte` converted to house's bare-icon form (was self-linking to a wrong `/sync` URL).
- ✅ Users list: `format_relative_time` + `format_date_time` tooltips on Last msg / Last visit / Joined.
- ✅ User detail: click-to-edit name (prompt, optimistic + rollback) via new `/api/admin/users/[id]/name` (POST, LD's nested convention rather than house's flat `/api/admin/set-name`) + `_call` + server test.
- ✅ Compose email port: `$lib/admin/messages/` (compose-email-modal, compose-recipients, recipient-input, cc-bcc-fields, resolve-compose-recipient + stories), utils (parse-email-list, is-image-mimetype, paste-image-from-clipboard), `StagedImageThumb`, `/api/messages/compose` + `_call` + full server test suite. Compose button on /admin/messages + "Compose email" (preset user) on user detail.
- ✅ RichTextEditor synced from house: `on_paste` hook, `should_autolink` (no more `.zip`/`.mov` gTLD autolinks), email paragraph spacing.
- ✅ cc/bcc columns on `messages` (migration `20260703a_message_cc_bcc.sql` + Drizzle schema); reply endpoint now stores + validates cc/bcc; reply-composer gained CcBccFields; thread view shows cc/bcc lines.
- ✅ admins.ts: Diego Mariscal → **Diego Córdova** (prod users row was already "Diego Córdova Nieto" — no prod write needed; the bad name only lived in the allow-list, which feeds chat + triage display).
- ✅ Channels: `anna-greg-jacob` removed, `diego-greg-jacob` ("Diego, Greg & Jacob": diego/greg/jacob) added to FIXED_CHANNELS; chat-db tests updated; migration `20260703_remove_anna_greg_jacob_channel.sql` deletes room + members + messages + attachments rows (applies on server boot AND admin clients at next deploy — channel appears lazily on first chat-API hit).
- ✅ Team page: members popover ported from house (click "N members" → names + online dots, click member → DM, "(you)" row; `ordered_member_ids` added to chat_store) + new `_page.stories.ts`.
- ✅ Presence: self excluded from count; 0 others → nothing shown; else "1 other online"/"N others online" — clickable, opens the same members popover.

## house tasks
- ✅ Users list + user detail header: relative dates + exact-time tooltips (Last msg / Last visit / Joined; Stripe period-end stays `format_date` — future date).
- ✅ Team page: same presence fix (others-only count, hidden at 0, clickable → existing popover). `.thread-sub` CSS folded into `.online-btn`.

## Verification
- LD: 1096 vitest pass, svelte-check 0 errors, lint clean; svelte-look screenshots: admin layout (desktop + mobile), compose modal (light+dark), reply composer w/ Cc/Bcc, messages page Compose button, team popover + only-me-online, user detail.
- house: 1413 vitest pass, svelte-check 0 errors, lint clean; svelte-look screenshot of team popover ("3 members · 1 other online").

## Deploy notes (when Jacob says push)
- LD prod picks up the channel swap + cc/bcc columns via migrations on container boot. Nothing manual.
- house changes are display-only, no migration.
