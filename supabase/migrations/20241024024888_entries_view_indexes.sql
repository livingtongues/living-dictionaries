CREATE INDEX idx_entries_updated_at ON entries (updated_at);
CREATE INDEX idx_entries_dictionary_id ON entries (dictionary_id);

-- Foreign Key Columns
CREATE INDEX idx_senses_entry_id ON senses (entry_id);
CREATE INDEX idx_audio_entry_id ON audio (entry_id);
CREATE INDEX idx_audio_speakers_audio_id ON audio_speakers (audio_id);
CREATE INDEX idx_entry_dialects_entry_id ON entry_dialects (entry_id);
CREATE INDEX idx_senses_in_sentences_sense_id ON senses_in_sentences (sense_id);
CREATE INDEX idx_sense_photos_sense_id ON sense_photos (sense_id);
CREATE INDEX idx_sense_videos_sense_id ON sense_videos (sense_id);

-- Deleted Columns
CREATE INDEX idx_senses_non_deleted ON senses (entry_id) WHERE deleted IS NULL;
CREATE INDEX idx_audio_non_deleted ON audio (entry_id) WHERE deleted IS NULL;
CREATE INDEX idx_audio_speakers_non_deleted ON audio_speakers (audio_id) WHERE deleted IS NULL;
CREATE INDEX idx_entry_dialects_non_deleted ON entry_dialects (entry_id) WHERE deleted IS NULL;
CREATE INDEX idx_senses_in_sentences_non_deleted ON senses_in_sentences (sense_id) WHERE deleted IS NULL;
CREATE INDEX idx_sense_photos_non_deleted ON sense_photos (sense_id) WHERE deleted IS NULL;
CREATE INDEX idx_sense_videos_non_deleted ON sense_videos (sense_id) WHERE deleted IS NULL;

-- Indexes helping with the ordering of items within each entry
-- CREATE INDEX idx_senses_created_at ON senses (created_at);
-- CREATE INDEX idx_audio_created_at ON audio (created_at);