# Import report as a durable artifact (email attachment + Import page)

Idea from Jacob, 2026-07-25, while reviewing the Eastern Pomo import preview.

## What exists after this session's work

- Every import produces a **preview HTML** before writing (guide §1.5) and now a
  **report HTML** after writing (guide §2.7): the questions the import raises at
  the top, each linked to the live entry it concerns, followed by what was
  imported, the decisions made, and the review queue — with a table of contents
  and collapsible sections.
- For imports **we** run, the finishing agent drafts a short requester-facing
  reply with that report attached, so it lands in the requester's inbox.

## The gap

An email attachment is a bad long-term home — "people's emails get too full".
The report should also be a **durable object the manager can open from the
dictionary's Import page**, months later, alongside the resources they uploaded.

## Sketch

- Store the report HTML in private R2 next to the import resources
  (`import/{dict}/reports/{thread_id}-{ts}.html` or under a new prefix), with a
  row in a `import_reports` table (shared.db, server-only): dictionary_id,
  import_thread_id, source_id, import_id, storage_key, created_at,
  created_by_user_id, entry_count, review_count.
- Serve it through the existing private file route pattern
  (`/api/v1/dictionaries/{id}/files/*` → a sibling `/reports/{id}` endpoint), so
  the same manager-or-admin auth applies.
- Surface on `/[dictionaryId]/import` — a "Past imports" section listing each
  report with its date, entry count, and outstanding review count, linking to the
  entries list filtered by that import's review queue.
- Consider exposing it in the v1 API too so an outside agent can POST its own
  report at the end of a job (`POST …/imports/{import_id}/report`), which is what
  would make the whole loop work for non-team imports.

## Open questions

- One report per import request thread, or per `import_id` run (a job can have
  several runs / a corrected re-sync)?
- Does the report get regenerated when review items are resolved, or is it a
  frozen snapshot of the moment of import? (Frozen is simpler and more honest;
  the live review queue already lives in the entries list.)
- Size/retention: these are small HTML files, but they embed sample entries —
  cap the sample, or store the payload separately?
