CREATE INDEX IF NOT EXISTS idx_entries_dictionary_id_id_where_not_deleted ON entries (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_senses_dictionary_id_id_where_not_deleted ON senses (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_audio_dictionary_id_id_where_not_deleted ON audio (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_speakers_dictionary_id_id_where_not_deleted ON speakers (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_tags_dictionary_id_id_where_not_deleted ON tags (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_dialects_dictionary_id_id_where_not_deleted ON dialects (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_dictionary_id_id_where_not_deleted ON photos (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_videos_dictionary_id_id_where_not_deleted ON videos (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_sentences_dictionary_id_id_where_not_deleted ON sentences (dictionary_id, id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_texts_dictionary_id_id_where_not_deleted ON texts (dictionary_id, id) WHERE deleted IS NULL;

CREATE INDEX IF NOT EXISTS idx_texts_dictionary_id_updated_at ON texts (dictionary_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_audio_speakers_dictionary_id_where_not_deleted ON audio_speakers (dictionary_id, audio_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_video_speakers_dictionary_id_where_not_deleted ON video_speakers (dictionary_id, video_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_entry_tags_dictionary_id_where_not_deleted ON entry_tags (dictionary_id, entry_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_entry_dialects_dictionary_id_where_not_deleted ON entry_dialects (dictionary_id, entry_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_sense_photos_dictionary_id_where_not_deleted ON sense_photos (dictionary_id, sense_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_sense_videos_dictionary_id_where_not_deleted ON sense_videos (dictionary_id, sense_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_senses_in_sentences_dictionary_id_where_not_deleted ON senses_in_sentences (dictionary_id, sense_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_sentence_photos_dictionary_id_where_not_deleted ON sentence_photos (dictionary_id, sentence_id) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_sentence_videos_dictionary_id_where_not_deleted ON sentence_videos (dictionary_id, sentence_id) WHERE deleted IS NULL;

DROP INDEX IF EXISTS idx_entries_updated_at;
DROP INDEX IF EXISTS idx_entries_dictionary_id;
DROP INDEX IF EXISTS entries_updated_at_dictionary_id_idx;

DROP INDEX IF EXISTS idx_senses_entry_id;
DROP INDEX IF EXISTS idx_audio_entry_id;
DROP INDEX IF EXISTS idx_audio_speakers_audio_id;
DROP INDEX IF EXISTS idx_entry_dialects_entry_id;
DROP INDEX IF EXISTS idx_senses_in_sentences_sense_id;
DROP INDEX IF EXISTS idx_sense_photos_sense_id;
DROP INDEX IF EXISTS idx_sense_videos_sense_id;

DROP INDEX IF EXISTS idx_senses_non_deleted;
DROP INDEX IF EXISTS idx_audio_non_deleted;
DROP INDEX IF EXISTS idx_audio_speakers_non_deleted;
DROP INDEX IF EXISTS idx_entry_dialects_non_deleted;
DROP INDEX IF EXISTS idx_senses_in_sentences_non_deleted;
DROP INDEX IF EXISTS idx_sense_photos_non_deleted;
DROP INDEX IF EXISTS idx_sense_videos_non_deleted;

DROP INDEX IF EXISTS idx_entry_tags_entry_id;
DROP INDEX IF EXISTS idx_entry_tags_non_deleted;

DROP INDEX IF EXISTS idx_senses_dictionary_id;
DROP INDEX IF EXISTS idx_audio_speakers_dictionary_id;
DROP INDEX IF EXISTS idx_video_speakers_dictionary_id;
DROP INDEX IF EXISTS idx_entry_tags_dictionary_id;
DROP INDEX IF EXISTS idx_entry_dialects_dictionary_id;
DROP INDEX IF EXISTS idx_sense_photos_dictionary_id;
DROP INDEX IF EXISTS idx_sense_videos_dictionary_id;
DROP INDEX IF EXISTS idx_senses_in_sentences_dictionary_id;
DROP INDEX IF EXISTS idx_sentence_videos_dictionary_id;
DROP INDEX IF EXISTS idx_sentence_photos_dictionary_id;
DROP INDEX IF EXISTS idx_texts_dictionary_id;