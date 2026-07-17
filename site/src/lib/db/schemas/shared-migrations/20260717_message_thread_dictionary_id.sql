-- Which dictionary a thread concerns, when known (import requests + contact
-- submissions that carry one). Nullable — older threads fall back to parsing
-- the thread's `url` slug client-side.
ALTER TABLE message_threads ADD COLUMN dictionary_id TEXT;
