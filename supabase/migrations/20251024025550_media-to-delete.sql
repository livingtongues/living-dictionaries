CREATE TABLE IF NOT EXISTS media_to_delete (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  dictionary_id text NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- entries.dictionary_id
ALTER TABLE entries
DROP CONSTRAINT entries_dictionary_id_fkey;
ALTER TABLE entries
ADD CONSTRAINT entries_dictionary_id_fkey
FOREIGN KEY (dictionary_id) REFERENCES dictionaries(id) ON DELETE CASCADE;

-- senses.entry_id
ALTER TABLE senses
DROP CONSTRAINT foreign_key_entries;
ALTER TABLE senses
ADD CONSTRAINT senses_entry_id_fkey
FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;

-- texts.dictionary_id
ALTER TABLE texts
DROP CONSTRAINT texts_dictionary_id_fkey;
ALTER TABLE texts
ADD CONSTRAINT texts_dictionary_id_fkey
FOREIGN KEY (dictionary_id) REFERENCES dictionaries(id) ON DELETE CASCADE;

-- sentences.dictionary_id
ALTER TABLE sentences
DROP CONSTRAINT sentences_dictionary_id_fkey;
ALTER TABLE sentences
ADD CONSTRAINT sentences_dictionary_id_fkey
FOREIGN KEY (dictionary_id) REFERENCES dictionaries(id) ON DELETE CASCADE;

-- sentences.text_id
ALTER TABLE sentences
DROP CONSTRAINT sentences_text_id_fkey;
ALTER TABLE sentences
ADD CONSTRAINT sentences_text_id_fkey
FOREIGN KEY (text_id) REFERENCES texts(id) ON DELETE CASCADE;

-- videos.text_id
ALTER TABLE videos
DROP CONSTRAINT videos_text_id_fkey;
ALTER TABLE videos
ADD CONSTRAINT videos_text_id_fkey
FOREIGN KEY (text_id) REFERENCES texts(id) ON DELETE CASCADE;

-- audio.entry_id
ALTER TABLE audio
DROP CONSTRAINT audio_entry_id_fkey;
ALTER TABLE audio
ADD CONSTRAINT audio_entry_id_fkey
FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;

-- audio.sentence_id
ALTER TABLE audio
DROP CONSTRAINT audio_sentence_id_fkey;
ALTER TABLE audio
ADD CONSTRAINT audio_sentence_id_fkey
FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE;

-- audio.text_id
ALTER TABLE audio
DROP CONSTRAINT audio_text_id_fkey;
ALTER TABLE audio
ADD CONSTRAINT audio_text_id_fkey
FOREIGN KEY (text_id) REFERENCES texts(id) ON DELETE CASCADE;

-- content_updates.dictionary_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_dictionary_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_dictionary_id_fkey
FOREIGN KEY (dictionary_id) REFERENCES dictionaries(id) ON DELETE CASCADE;

-- content_updates.entry_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_entry_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_entry_id_fkey
FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;

-- content_updates.sense_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_sense_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_sense_id_fkey
FOREIGN KEY (sense_id) REFERENCES senses(id) ON DELETE CASCADE;

-- content_updates.sentence_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_sentence_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_sentence_id_fkey
FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE;

-- content_updates.text_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_text_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_text_id_fkey
FOREIGN KEY (text_id) REFERENCES texts(id) ON DELETE CASCADE;

-- content_updates.audio_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_audio_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_audio_id_fkey
FOREIGN KEY (audio_id) REFERENCES audio(id) ON DELETE CASCADE;

-- content_updates.video_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_video_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_video_id_fkey
FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

-- content_updates.photo_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_photo_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_photo_id_fkey
FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE;

-- content_updates.speaker_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_speaker_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_speaker_id_fkey
FOREIGN KEY (speaker_id) REFERENCES speakers(id) ON DELETE CASCADE;

-- content_updates.dialect_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_dialect_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_dialect_id_fkey
FOREIGN KEY (dialect_id) REFERENCES dialects(id) ON DELETE CASCADE;

-- content_updates.tag_id
ALTER TABLE content_updates
DROP CONSTRAINT content_updates_tag_id_fkey;
ALTER TABLE content_updates
ADD CONSTRAINT content_updates_tag_id_fkey
FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

-- dictionary_partners.photo_id
ALTER TABLE dictionary_partners
DROP CONSTRAINT dictionary_partners_photo_id_fkey;
ALTER TABLE dictionary_partners
ADD CONSTRAINT dictionary_partners_photo_id_fkey
FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE;