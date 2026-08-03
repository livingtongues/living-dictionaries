# Triaging a "my dictionary is broken" report

What a user reports is what they SAW, not what happened. Two independent 2026-08-03 findings
worth reusing:

## The report's `url` column tells you where it was filed from

`message_threads.url` is the page the contact form was open on. When a report says "the site is
broken", that column is usually the incident itself — for Cosmas Rai's *"the Dictionary Girlangue
does not open anymore"* it was
`/girlangue-ghana/entry/497bb70f-…`, i.e. he reported from the error page's OWN Contact button
after clicking a dead entry link. Check it before you check anything else; it often makes the whole
investigation two minutes long.

## Proving an id NEVER existed (vs. was deleted, vs. was lost)

Three places, in this order — all read-only on the VPS:

1. `dictionaries/<dict>.db` → `entries` — is it there now?
2. same file → `deletes` (tombstones survive the row; `process_delete_cascade` hard-deletes) —
   was it deleted?
3. `dictionaries/<dict>.history.db` → `changes` — was it ever created/edited, and by whom
   (`api_key_id` non-NULL = an agent)?

If all three are empty, the id never reached the server. Then check `logs.db`: the FIRST
`received_at` for that URL anywhere in the table, plus the row's `context.breadcrumbs`. Empty
breadcrumbs = direct navigation (pasted/clicked from outside the app), not a click on one of our own
links — which distinguishes "we generated a bad link" from "someone handed the user a bad link".
Chatbot-fabricated URLs are a real source now: the same user's traffic carried
`?utm_source=copilot.com`, and ChatGPT-sourced dead links show up too.

Reconstructing the user's session from `client_logs` (`WHERE user_id = …`, drop `heartbeat`/`perf`)
also answers "is the app actually broken for them RIGHT NOW" — in that case his own log showed him
searching and deleting an entry three minutes *after* he wrote to say nothing worked.

## Don't stop at the individual

`SELECT json_extract(context,'$.status') …` over `client_logs` turns one anecdote into a
population: 769 real browser sessions (`session_id NOT NULL`, which drops scanner noise) had hit a
404 error page in 30 days, and grouping the paths against the live catalog separated dead
dictionaries (nothing to fix) from **live** dictionaries with dead sub-paths — `synopsis` alone was
127 hits, which is what justified the legacy 301s in
`routes/[dictionaryId]/[...unmatched]/legacy-paths.ts`.
