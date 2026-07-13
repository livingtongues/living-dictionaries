# ✅ DONE (2026-07-13): progressive disclosure for the v1 OpenAPI spec

Implemented `?view=index` + `?tag=<name>` slicing. See "What shipped" below. The
sense-level geometry item at the bottom stays genuinely future.

---

# Future: progressive disclosure for the v1 OpenAPI spec

`GET /api/v1/openapi.json` currently serves the ENTIRE spec in one response
(~100 KB / ~25–30k tokens as of 2026-07-13, and growing with every new field/route).
An agent slurps the whole thing to self-configure. That's fine today but is near the
edge of comfortable for an agent context window, and it only grows.

## When to act
When the spec gets painful to fetch whole (agents truncating it, or it crosses
~40–50k tokens). No action needed until then — this is a heads-up, not a task.

## The cheap shape (because the spec is one hand-built function)
`build_openapi_spec({ origin })` in `src/lib/api/v1/openapi.ts` assembles everything,
so slicing it is easy:

- **`?view=index`** → return `info` + a flat list of `{ path, method, summary }` +
  the schema NAMES only (no property bodies). A small map an agent reads first.
- **`?tag=entries|dialects|media|texts|sources|…`** → return only that group's paths
  with their `$ref`-complete schemas. Add OpenAPI `tags` to each operation to drive
  the grouping (they're currently untagged).
- Keep the full-spec response as the default for backward compatibility.

The `feedback` prose in the spec already tells agents to ask for what they need; a
follow-on could point them at `?view=index` first.

## What shipped (2026-07-13)
- `build_openapi_spec` now tags every operation (derived from its path via `tag_for_path`) and
  emits a top-level `tags` list (`OPENAPI_TAGS`) — no per-operation hand-annotation. `media` wins
  over the owning resource for any `…/audio|photos|videos` path.
- New exported `select_openapi_view({ spec, view, tag })`:
  - `?view=index` → `info` (short pointer prose) + `{ path → { method → { summary, tags } } }` +
    a top-level `schema_names` array. No property bodies, no `components`.
  - `?tag=<name>` → only that group's paths, with **all** component schemas retained so every
    `$ref` still resolves; `tags` filtered to the one group.
  - neither → the full spec (backward-compatible default).
- Route `src/routes/api/v1/openapi.json/+server.ts` reads `view`/`tag` query params.
- The spec's own info prose gained a "## Fetching this spec (progressive disclosure)" section so
  agents discover the two views.
- Tests in `openapi.test.ts`: tag coverage, `tag_for_path` mapping, index shape (summaries + schema
  names only), tag=dialects (only dialect paths, schemas retained), tag=media (cross-owner collect).

## Related future work (recorded here to keep it from getting lost)
- **Sense-level geometry** — `coordinates` currently lands on entries + dialects
  (see `.issues/v1-entry-coordinates.md`). Sense-level was explicitly deferred; it
  needs a schema migration + UI + sync work. Revisit if demand appears.
- **Dialect coordinates UI** — the API + read shape ship now, but there is no
  human-side management surface for a dialect's geometry (dialects have no editor UI
  at all, not even rename). Reuse `GeoTaggingModal` once a dialects manager exists.
  Tracked as the follow-up below.
