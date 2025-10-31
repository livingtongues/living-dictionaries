- Admin hits delete on a dictionary which runs this endpoint.
- Verify is admin user on endpoint.
- Create a table called "media_to_delete" with the fields:
  - id (uuid)
  - dictionary_id (uuid) (but no relationship to avoid cascade delete)
  - storage_path (text)
  - created_at (timestamp)
- Go through all media entries and write the storage_path into the table called "media_to_delete" with a timestamp.
  - audio, photos, videos
- Delete all dictionary data from tables in Supabase using dictionary_id by just deleting the dictionary table entry and letting everything cascade including:
  - entries (will not cascade)
  - senses
  - texts (will not cascade)
  - sentences
  - words
  - audio
  - photos
  - videos
  - sentence_audios
  - sentence_photos
  - sentence_videos

Based on the provided schema, the following tables have foreign key constraints referencing other tables (primarily dictionaries, but also in the hierarchy like entries, texts, etc.) without ON DELETE CASCADE. These will prevent full cascading deletion when a dictionary is deleted, as PostgreSQL defaults to RESTRICT (or NO ACTION), blocking the delete if child rows exist:

entries (on dictionary_id → dictionaries.id)
senses (on entry_id → entries.id)
texts (on dictionary_id → dictionaries.id)
sentences (on dictionary_id → dictionaries.id and text_id → texts.id)
videos (on text_id → texts.id)
audio (on entry_id → entries.id, sentence_id → sentences.id, and text_id → texts.id)
content_updates (on all its foreign keys: dictionary_id → dictionaries.id, entry_id → entries.id, sense_id → senses.id, sentence_id → sentences.id, text_id → texts.id, audio_id → audio.id, video_id → videos.id, photo_id → photos.id, speaker_id → speakers.id, dialect_id → dialects.id, tag_id → tags.id)
dictionary_partners (on photo_id → photos.id)

- Return success message.

TODO: think if we want to refresh the dictionaries_view and materialized_dictionaries_view views here or leave that to a later cron job or manual refresh.
TODO: Later on our own time, on our local devices, we can run a media delete script.
- delete items from media_to_delete and remove row from "media_to_delete" table.

TODO: update summarized-migrations.sql to add ON DELETE CASCADE to the relevant foreign key constraints.
TODO: remove dictionary_partners.photo_id ON DELETE CASCADE
