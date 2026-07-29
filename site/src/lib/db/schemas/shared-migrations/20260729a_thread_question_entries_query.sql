------------------------------------------------------------------
-- Ask each import question ON the rows it is about (2026-07-29).
--
-- 15 curator questions issued, 3 answered. The most engaged curator sat on his
-- conversation page for five minutes, answered none of his 6, then went to the
-- entries list and hand-filtered `no_audio` + `no_part_of_speech` — which is
-- what two of those questions were asking about. The questions lose to the
-- curator's own instinct because they are asked in prose, away from the data.
--
-- `entries_query` is a validated `?q=` filter object (the same vocabulary the
-- entries view already takes in its URL) rendered as a "Show me these entries"
-- button on the question. `entries_query_label` is the agent's own wording for
-- that button when it knows the count ("Show me these 1,191 entries").
------------------------------------------------------------------
ALTER TABLE thread_questions ADD COLUMN entries_query TEXT;
ALTER TABLE thread_questions ADD COLUMN entries_query_label TEXT;
