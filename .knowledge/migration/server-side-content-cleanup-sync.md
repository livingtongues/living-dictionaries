# Server-side bulk cleanup of per-dict content that reaches clients

How to run a one-off/maintenance write directly against the VPS
`dictionaries/<id>.db` files and have it **converge to already-open editors AND
cold loaders** — without hand-writing a migration or touching the browser.

First applied 2026-07-09 by the systematic tag/dialect dedup
(`$lib/db/server/dedup-labels.ts` + `/api/admin/dedup-labels`, level-3, `dry_run`
mode). ~40 dicts carried piles of same-name `tags`/`dialects` from the write-side
dup bug fixed in `d0c2fc5f`.

## The two propagation channels (both required)

A per-dict content edit made on the server reaches browsers by **two** independent
paths — a bulk fix must feed both:

1. **`/changes` delta pull → already-connected editors.**
   `process_dict_changes` (`dictionary-sync-helpers.ts`) returns, to any client
   whose cursor is behind: every row with `updated_at > cursor`, and every
   `deletes` tombstone with `updated_at > cursor`. So the fix must:
   - write NEW/updated rows with a **fresh `updated_at`** (the insert/update
     `*_bump_lmod` triggers advance the dict's `last_modified_at` cursor for you), and
   - express every removal as a **`deletes` tombstone** (use `delete_dict_row` —
     it inserts the tombstone, which fires `process_delete_cascade` to hard-delete
     the row + FK-cascade its children, and bumps the cursor once).
   The client applies each tombstone through its OWN `process_delete_cascade`, so
   FK-cascaded children (e.g. a merged tag's junctions) are swept locally — you do
   NOT need to emit child tombstones.

2. **R2 snapshot rebuild → cold/first loaders.**
   Bump `shared.db.dictionaries.updated_at` for each touched dict. The
   `r2-snapshot-builder` sweep (`sweep_dirty_dictionaries`, ≤30 min) rebuilds any
   dict whose `updated_at > snapshot_uploaded_at`. Direct dict.db writes bump the
   dict's live cursor but NOT the catalog mirror, so this bump is a manual,
   required step (the boot-time `reconcile_dictionary_catalog` would eventually
   catch it, but don't rely on a restart).

## Junction repointing pattern (merge B into canonical A)

For each entry linked to a to-be-removed label, **ensure the canonical junction
exists** (mint a fresh-id junction only if absent — `entry_tags`/`entry_dialects`
carry a UNIQUE(entry_id, label_id), so a blind insert would 500 the push). Then
tombstone the dup label; its own junctions FK-cascade away. Net effect: entries
keep exactly one label, repointed to canonical. On big dicts this creates many
junction rows (a dialect on ~all entries → thousands of repoints) — correct, just
verbose in `/changes`.

## Ops recipe used
1. Read-only count in-container (`docker exec -i sveltekit_blue node <script>`) to
   size the blast radius — matched the endpoint's own `dry_run` numbers.
2. `.backup()` every affected dict.db + shared.db to `.bak-<ts>` (consistent, not `cp`).
3. Deploy the tested endpoint (push `main`), then invoke it with a super-admin JWT
   **minted inside the container** (read `JWT_SECRET` there; HS256 over
   `{sub,email,name,iat,exp}` — matches `jose`) and `fetch` the **public** origin
   (the app doesn't answer on `localhost:3000` from a sidecar `docker exec` under
   blue/green — hit `https://livingdictionaries.app` instead).
4. `dry_run:true` → verify → `dry_run:false`. Re-count to confirm 0 remain.

## Gotcha
Under blue/green, `docker exec sveltekit_blue` is NOT necessarily the container
Caddy serves — `localhost:3000` inside it can `ECONNREFUSED`. Mint locally, call
the public URL.
