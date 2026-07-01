# Agents: empty-entries state, Agents sidebar page, agent-vs-human history attribution

Three linked workstreams. Decisions captured from the design interview with Jacob.

## A. Empty-entries state (entries page)
When a dictionary has **0 entries** (genuinely empty, not a search-miss), show a centered card:
- `can_edit` users: a big **Add your first entry** button (reuse `AddEntry.svelte`).
- `is_manager` only: a smaller line **"Working with an AI agent? Create a key →"** → links to `/<url>/agents`. No import mention (deliberate — we want agents doing imports, not manual files).
- viewers (`!can_edit`): just "No entries yet."
- Gate on `!loading` so it doesn't flash while the bundle is still loading. Only when `entries_length === 0`.
- Distinct from "search found nothing" (entries exist but filter returns 0) — that keeps the existing `0 / N` meta.

## B. Agents sidebar page (move API keys out of Settings)
- New route `/[dictionaryId]/agents`. Visible to **editors + managers** (`is_editor_or_above`); robot icon; sits right after Settings in `SideMenu`.
- Editors get a **read-only** view (key list + explainer); only **managers** mint/revoke (`can_manage`).
- Page = short "point your agent at `/api/v1`" explainer + link to API docs, then the keys manager.
- Remove `<ApiKeys>` from `settings/+page.svelte`.
- Relax `GET /api/dictionaries/[id]/api-keys` to **editor** (was manager) so editors can list; POST/DELETE stay manager.

## C. Agent-vs-human history attribution (history DB only)
- `user_id` stays the single responsible human (for a key = its creator — already true).
- **Revoke, never hard-delete keys**: the `[key_id]` endpoint sets `revoked_at` and retains the row forever so `api_key_id` always resolves to label + creator. `list_api_keys` filters `revoked_at IS NULL` (revoked keys are backend-only — NOT shown in any UI, no "revoked" section).
- History migration: `ALTER TABLE changes ADD COLUMN api_key_id TEXT` (server-only history.db; no sync/snapshot impact). NO `agent_label` snapshot, NO `via` column — agent-ness is `api_key_id IS NOT NULL`.
- Thread `access.key_id` from the v1 write paths (`apply_entry_writes` / `apply_entry_update` / `apply_entry_delete` → `merge_dict_row` → `HistoryEvent.api_key_id`). Browser `/changes` push is always session → null.
- Read side: `query_history` selects `api_key_id`, returns an `api_keys` map `{ id → { id, label, created_by_user_id } }` resolved from shared.db; add optional `?actor=agents|humans` filter.
- UI: agent badge in `ChangeTimeline` ("🤖 {label} · on behalf of {user}") + an All/People/Agents toggle in `ChangeHistory` (feed only).

## Notes / conventions
- New agent/empty-state copy is hardcoded English, matching the neighboring `ApiKeys.svelte` (already all-English). Reuse existing `t('entry.add_entry')` where present.
- `~icons/fa6-solid/robot` for the sidebar + badge.

## Status
- [x] A empty state — `EntriesEmptyState.svelte` + wired into `entries/+page.svelte` (`entries_length === 0 && !$loading`).
- [x] B agents page (`/[dictionaryId]/agents`) + sidebar item (editor+, robot icon, after Settings) + `ApiKeys` moved out of Settings + `can_manage` read-only mode + GET endpoint relaxed to editor.
- [x] C history migration (`20260630_api_key_attribution.sql`, `changes.api_key_id`) + `merge_dict_row`/`apply_entry_*` threading + `query_history` resolve + `?actor` filter + agent badge in `ChangeTimeline` + All/People/Agents toggle in `ChangeHistory` + revoke-not-delete (`revoke_api_key`, list filters `revoked_at IS NULL`, `[key_id]` endpoint revokes).
- [x] tests: api-key revoke/resolve, history agent attribution, api-keys endpoint editor-list/revoke. `pnpm check` 0 errors, lint clean. Agent badge visually verified via svelte-look.

## Verification notes
- svelte-look `ChangeTimeline/EntryTimeline` shows "🤖 Dictionary agent · Ada Researcher" pill on the agent row, plain names elsewhere.
- The dict that triggered this is genuinely empty → empty state will show the "Add your first entry" + manager agent CTA.
