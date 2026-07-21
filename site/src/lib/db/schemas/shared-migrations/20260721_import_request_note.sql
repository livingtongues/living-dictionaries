-- Store the editable overall note once on the import request thread rather
-- than duplicating it across every source_files row in the request batch.
ALTER TABLE message_threads ADD COLUMN import_request_note TEXT;

-- Recover notes from import requests created before this column existed. The
-- original message remains immutable history; this is the current editable
-- value shown on the dictionary import page.
UPDATE message_threads
SET import_request_note = (
  SELECT trim(substr(
    messages.body_text,
    instr(messages.body_text, 'Note from the requester: ') + length('Note from the requester: '),
    instr(
      substr(
        messages.body_text,
        instr(messages.body_text, 'Note from the requester: ') + length('Note from the requester: ')
      ),
      char(10) || char(10) || 'Resources ('
    ) - 1
  ))
  FROM messages
  WHERE messages.thread_id = message_threads.id
    AND instr(messages.body_text, 'Note from the requester: ') > 0
  ORDER BY messages.created_at
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM source_files WHERE source_files.import_thread_id = message_threads.id
)
AND EXISTS (
  SELECT 1
  FROM messages
  WHERE messages.thread_id = message_threads.id
    AND instr(messages.body_text, 'Note from the requester: ') > 0
    AND instr(
      substr(
        messages.body_text,
        instr(messages.body_text, 'Note from the requester: ') + length('Note from the requester: ')
      ),
      char(10) || char(10) || 'Resources ('
    ) > 0
);
