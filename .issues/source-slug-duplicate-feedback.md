# Handle duplicate source slugs before dictionary writes

The 2026-07-23 production log review found one signed-in contributor on `iipay-aa` blocked twice by:

`UNIQUE constraint failed: sources.slug`

Breadcrumbs show the contributor repeatedly used **Add source → Save** from an entry. The current
`EditSource.svelte` modal derives a slug, calls `writes.insert_source`, then closes without checking for
an existing slug or handling a write error. The database constraint protects integrity, but the user
gets no useful resolution path.

Plan:

- [x] Check the live local `sources` table for the normalized slug before inserting.
- [x] If it exists, offer/select the existing source (entry flow) or keep the modal open with a clear
  “slug already exists” message and link the user to edit that source.
- [x] Keep the modal open on any write failure; only call `on_saved` and `on_close` after success.
- [x] Emit a handled `source_save_failed` warning with dictionary id, operation, failure kind, and
  normalized slug (no citation text) so future failures are distinguishable without relying on a
  patched `console.error`.
- [x] Add component/write-path tests for duplicate slug and successful save behavior.

The duplicate state was visually verified through the `DuplicateSlug` svelte-look story in both
light and dark mode at 640×900.

Severity: P2 — a contributor-facing edit flow is blocked, with no actionable feedback.
