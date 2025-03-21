CREATE TABLE senses (
  id uuid unique primary key NOT NULL, -- generated on client so users can create a sense offline and keep editing it
  entry_id text NOT NULL REFERENCES entries,
  "definition" jsonb, -- MultiString
  glosses jsonb, -- MultiString
  parts_of_speech text[],
  semantic_domains text[],
  write_in_semantic_domains text[],
  noun_class character varying,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by text NOT NULL, -- TODO: go through existing senses and connect to user_id, then change to uuid and add REFERENCES auth.users
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by text NOT NULL, -- TODO: go through existing senses and connect to user_id, then change to uuid and add REFERENCES auth.users
  deleted timestamp with time zone,
  plural_form jsonb, -- MultiString
  variant jsonb -- MultiString
);

ALTER TABLE senses ENABLE ROW LEVEL SECURITY;

CREATE TYPE entry_tables AS ENUM ('senses'); -- not using
CREATE TYPE entry_columns AS ENUM ('deleted', 'glosses', 'parts_of_speech', 'semantic_domains', 'write_in_semantic_domains', 'noun_class', 'definition'); -- not using

CREATE TABLE entry_updates ( -- TODO: drop this table
  id uuid unique primary key NOT NULL,
  user_id text NOT NULL,
  dictionary_id text NOT NULL,
  entry_id text NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "table" entry_tables NOT NULL,
  "row" text NOT NULL,
  "column" entry_columns NOT NULL,
  new_value text,
  old_value text
);

ALTER TABLE entry_updates ENABLE ROW LEVEL SECURITY;

CREATE TYPE certainty AS ENUM ('yes', 'no', 'unknown');

CREATE TABLE dictionaries (
  id text unique primary key NOT NULL,
  url text unique NOT NULL,
  name text NOT NULL,
  alternate_names text[],
  orthographies jsonb[], -- defaults to latin first, but other bcp codes or custom orthographies can be added, these are the keys for MultiString used by each dictionary
  gloss_languages text[],
  location text,
  iso_639_3 text,
  glottocode text,
  coordinates jsonb, -- Coordinates
  public boolean NOT NULL DEFAULT false,
  print_access boolean,
  copyright text,

  language_used_by_community boolean,
  community_permission certainty,
  author_connection text,
  con_language_description text,

  featured_image jsonb,
  hide_living_tongues_logo boolean,
  metadata jsonb, -- tdv1 info
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE dictionaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for dictionaries"
ON dictionaries
FOR SELECT USING(true);

CREATE TABLE entries (
  id text unique primary key NOT NULL, -- generated on client so users can create an entry offline and keep editing it
  dictionary_id text NOT NULL REFERENCES dictionaries,
  lexeme jsonb NOT NULL, -- MultiString
  phonetic text,
  interlinearization text,
  morphology text,
  notes jsonb, -- MultiString
  sources text[],
  scientific_names text[],
  coordinates jsonb, -- Coordinates
  unsupported_fields jsonb, -- to place fields from imports like FLEx that don't fit into the current fields
  elicitation_id text, -- Elicitation Id for Munda languages or Swadesh Composite number list from Comparalex, used for Onondaga custom sort
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE texts (
  id uuid unique primary key NOT NULL, -- generated on client so users can create a text offline and keep editing it
  dictionary_id text NOT NULL REFERENCES dictionaries,
  title jsonb NOT NULL, -- MultiString
  sentences jsonb NOT NULL, -- array of sentence ids to be able to know order, also includes paragraph breaks
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE texts ENABLE ROW LEVEL SECURITY;

CREATE TABLE sentences (
  id uuid unique primary key NOT NULL, -- generated on client so users can create a sentence offline and keep editing it
  dictionary_id text NOT NULL REFERENCES dictionaries,
  "text" jsonb, -- MultiString
  translation jsonb, -- MultiString
  text_id uuid REFERENCES texts, -- if part of a text
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE sentences ENABLE ROW LEVEL SECURITY;

CREATE TABLE senses_in_sentences (
  sense_id uuid NOT NULL REFERENCES senses ON DELETE CASCADE,
  sentence_id uuid NOT NULL REFERENCES sentences ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted timestamp with time zone,
  PRIMARY KEY (sense_id, sentence_id)
);

ALTER TABLE senses_in_sentences ENABLE ROW LEVEL SECURITY;

CREATE TABLE photos (
  id uuid primary key default uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  storage_path text NOT NULL,
  serving_url text NOT NULL,
  source text,
  photographer text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE videos (
  id uuid primary key default uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  storage_path text,
  hosted_elsewhere jsonb, -- Hosted elsewhere (e.g. YouTube, Vimeo, etc.)
  text_id uuid REFERENCES texts,
  source text,
  videographer text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE audio (
  id uuid primary key default uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  entry_id text REFERENCES entries,
  sentence_id uuid REFERENCES sentences,
  text_id uuid REFERENCES texts,
  storage_path text NOT NULL,
  source text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE audio ENABLE ROW LEVEL SECURITY;

CREATE TYPE gender AS ENUM ('m', 'f', 'o');

CREATE TABLE speakers (
  id uuid primary key default uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users, -- only if speaker has an account
  name text NOT NULL,
  decade integer,
  gender gender,
  birthplace text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE speakers ENABLE ROW LEVEL SECURITY;

-- RELATIONSHIPS

CREATE TABLE audio_speakers (
  audio_id uuid NOT NULL REFERENCES audio ON DELETE CASCADE,
  speaker_id uuid NOT NULL REFERENCES speakers ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone,
  PRIMARY KEY (audio_id, speaker_id)
);

ALTER TABLE audio_speakers ENABLE ROW LEVEL SECURITY;

CREATE TABLE video_speakers (
  video_id uuid NOT NULL REFERENCES videos ON DELETE CASCADE,
  speaker_id uuid NOT NULL REFERENCES speakers ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone,
  PRIMARY KEY (video_id, speaker_id)
);

ALTER TABLE video_speakers ENABLE ROW LEVEL SECURITY;

CREATE TABLE sense_videos (
  sense_id uuid NOT NULL REFERENCES senses ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone,
  PRIMARY KEY (sense_id, video_id)
);

ALTER TABLE sense_videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE sentence_videos (
  sentence_id uuid NOT NULL REFERENCES sentences ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone,
  PRIMARY KEY (sentence_id, video_id)
);

ALTER TABLE sentence_videos ENABLE ROW LEVEL SECURITY;

CREATE TABLE sense_photos (
  sense_id uuid NOT NULL REFERENCES senses ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES photos ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone,
  PRIMARY KEY (sense_id, photo_id)
);

ALTER TABLE sense_photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE sentence_photos (
  sentence_id uuid NOT NULL REFERENCES sentences ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES photos ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone,
  PRIMARY KEY (sentence_id, photo_id)
);

ALTER TABLE sentence_photos ENABLE ROW LEVEL SECURITY;

CREATE TYPE content_tables AS ENUM ('entries', 'senses', 'sentences', 'senses_in_sentences', 'texts', 'audio', 'video', 'photo', 'speakers', 'audio_speakers', 'video_speakers', 'sense_videos', 'sentence_videos', 'sense_photos', 'sentence_photos');

CREATE TABLE content_updates (
  id uuid unique primary key NOT NULL, -- generated by client via uuidv4 so it can be idempotent and they can send it multiple times without repeated effect in case of network issues
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,
  dictionary_id text NOT NULL REFERENCES dictionaries,
  entry_id text REFERENCES entries,
  sense_id uuid REFERENCES senses,
  sentence_id uuid REFERENCES sentences,
  text_id uuid REFERENCES texts,
  audio_id uuid REFERENCES audio,
  video_id uuid REFERENCES videos,
  photo_id uuid REFERENCES photos,
  speaker_id uuid REFERENCES speakers,
  dialect_id uuid REFERENCES dialects,
  tag_id uuid REFERENCES tags,
  "table" content_tables, -- will drop down the road
  change jsonb,
  "data" jsonb,
  "type" text,
  "timestamp" timestamp with time zone NOT NULL DEFAULT now(),
  import_id text
);

ALTER TABLE content_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Can view content updates" 
ON content_updates
FOR SELECT
USING (TRUE);

CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_created_by_trigger_dictionaries
BEFORE UPDATE ON dictionaries
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_entries
BEFORE UPDATE ON entries
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_senses
BEFORE UPDATE ON senses
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_texts
BEFORE UPDATE ON texts
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_sentences
BEFORE UPDATE ON sentences
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_photos
BEFORE UPDATE ON photos
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_audio
BEFORE UPDATE ON audio
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_videos
BEFORE UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_created_by_trigger_speakers
BEFORE UPDATE ON speakers
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE VIEW public.user_emails AS SELECT id, email, last_sign_in_at, created_at FROM auth.users;
REVOKE ALL ON public.user_emails FROM anon, authenticated;

CREATE TABLE dialects (
  id uuid unique primary key NOT NULL,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  name jsonb NOT NULL, -- MultiString
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE dialects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dialects"
ON dialects 
FOR SELECT USING (true);

CREATE TABLE entry_dialects (
  entry_id text NOT NULL REFERENCES entries ON DELETE CASCADE,
  dialect_id uuid NOT NULL REFERENCES dialects ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted timestamp with time zone,
  PRIMARY KEY (entry_id, dialect_id)
);

ALTER TABLE entry_dialects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_created_by_trigger_dialects
BEFORE UPDATE ON dialects
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE VIEW speakers_view AS
SELECT
  id,
  dictionary_id,
  name,
  decade,
  gender,
  birthplace,
  created_at,
  updated_at,
  deleted
FROM speakers;

CREATE POLICY "Anyone can view sentences"
ON sentences 
FOR SELECT USING (true);

CREATE POLICY "Anyone can view photos"
ON photos 
FOR SELECT USING (true);

CREATE VIEW videos_view AS
SELECT
  videos.id AS id,
  videos.dictionary_id AS dictionary_id,
  videos.storage_path AS storage_path,
  videos.source AS source,
  videos.videographer AS videographer,
  videos.hosted_elsewhere AS hosted_elsewhere,
  videos.text_id AS text_id,
  video_speakers.speaker_ids AS speaker_ids,
  videos.created_at AS created_at,
  videos.updated_at AS updated_at,
  videos.deleted AS deleted
FROM videos
LEFT JOIN (
  SELECT
    video_id,
    jsonb_agg(speaker_id) AS speaker_ids
  FROM video_speakers
  WHERE deleted IS NULL
  GROUP BY video_id
) AS video_speakers ON video_speakers.video_id = videos.id;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

CREATE INDEX ON entries USING btree ("updated_at", "dictionary_id");

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

ALTER ROLE "anon" SET "statement_timeout" TO '8s';
NOTIFY pgrst, 'reload config';


CREATE TABLE tags (
  id uuid unique primary key NOT NULL,
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  name text NOT NULL,
  private boolean,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags"
ON tags 
FOR SELECT USING (true);

CREATE TABLE entry_tags (
  entry_id text NOT NULL REFERENCES entries ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted timestamp with time zone,
  PRIMARY KEY (entry_id, tag_id)
);

ALTER TABLE entry_tags ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_created_by_trigger_tags
BEFORE UPDATE ON tags
FOR EACH ROW
EXECUTE FUNCTION set_created_by();

CREATE INDEX idx_entry_tags_entry_id ON entry_tags (entry_id);
CREATE INDEX idx_entry_tags_non_deleted ON entry_tags (entry_id) WHERE deleted IS NULL;


CREATE OR REPLACE FUNCTION update_entry_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  entry_id_to_use text;
  new_updated_at timestamp with time zone;
BEGIN
  entry_id_to_use := COALESCE(NEW.entry_id, OLD.entry_id);
  
  BEGIN
    new_updated_at := NEW.updated_at;
  EXCEPTION
    WHEN others THEN
      new_updated_at := NULL;
  END;
  
  UPDATE entries
  SET updated_at = COALESCE(new_updated_at, NEW.created_at, NOW())
  WHERE id = entry_id_to_use;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_entry_updated_at_senses
AFTER INSERT OR UPDATE ON senses
FOR EACH ROW
EXECUTE FUNCTION update_entry_updated_at();

CREATE TRIGGER update_entry_updated_at_audio
AFTER INSERT OR UPDATE ON audio
FOR EACH ROW
EXECUTE FUNCTION update_entry_updated_at();

CREATE TRIGGER update_entry_updated_at_entry_dialects
AFTER INSERT OR UPDATE ON entry_dialects
FOR EACH ROW
EXECUTE FUNCTION update_entry_updated_at();

CREATE TRIGGER update_entry_updated_at_entry_tags
AFTER INSERT OR UPDATE ON entry_tags
FOR EACH ROW
EXECUTE FUNCTION update_entry_updated_at();

CREATE OR REPLACE FUNCTION update_sense_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE senses
  SET updated_at = COALESCE(NEW.deleted, NEW.created_at, NOW())
  WHERE id = NEW.sense_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_senses_in_sentences
AFTER INSERT OR UPDATE ON senses_in_sentences
FOR EACH ROW
EXECUTE FUNCTION update_sense_updated_at();

CREATE TRIGGER update_sense_updated_at_sense_photos
AFTER INSERT OR UPDATE ON sense_photos
FOR EACH ROW
EXECUTE FUNCTION update_sense_updated_at();

CREATE TRIGGER update_sense_updated_at_sense_videos
AFTER INSERT OR UPDATE ON sense_videos
FOR EACH ROW
EXECUTE FUNCTION update_sense_updated_at();

CREATE OR REPLACE FUNCTION update_sense_sentences_when_sentence_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted IS NOT NULL THEN
    UPDATE sense_sentences
    SET deleted = NEW.deleted
    WHERE sentence_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_sense_sentences
AFTER UPDATE ON sentences
FOR EACH ROW
EXECUTE FUNCTION update_sense_sentences_when_sentence_deleted();

CREATE OR REPLACE FUNCTION update_sense_photos_when_photo_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted IS NOT NULL THEN
    UPDATE sense_photos
    SET deleted = NEW.deleted
    WHERE photo_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_sense_photos
AFTER UPDATE ON photos
FOR EACH ROW
EXECUTE FUNCTION update_sense_photos_when_photo_deleted();

CREATE OR REPLACE FUNCTION update_sense_videos_when_video_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted IS NOT NULL THEN
    UPDATE sense_videos
    SET deleted = NEW.deleted
    WHERE video_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sense_updated_at_sense_videos
AFTER UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION update_sense_videos_when_video_deleted();

CREATE OR REPLACE FUNCTION update_audio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE audio
  SET updated_at = COALESCE(NEW.created_at, NOW())
  WHERE id = NEW.audio_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_audio_updated_at_audio_speakers
AFTER INSERT OR UPDATE ON audio_speakers
FOR EACH ROW
EXECUTE FUNCTION update_audio_updated_at();

CREATE VIEW dictionaries_view AS
SELECT
  dictionaries.id,
  url,
  name,
  alternate_names,
  gloss_languages,
  location,
  dictionaries.coordinates,
  iso_639_3,
  glottocode,
  public,
  print_access,
  dictionaries.metadata,
  COUNT(entries.id) AS entry_count,
  -- Below is just for the admin table, only the above is included in the materialized view which is used on the homepage and the dictionaries listing page
  orthographies,
  featured_image,
  author_connection,
  community_permission,
  language_used_by_community,
  con_language_description,
  copyright,
  dictionaries.created_at,
  dictionaries.created_by,
  dictionaries.updated_at,
  dictionaries.updated_by
FROM dictionaries
  LEFT JOIN entries ON entries.dictionary_id = dictionaries.id AND entries.deleted IS NULL -- can take out the LEFT to eliminate dictionaries with 0 entries
WHERE dictionaries.deleted IS NULL
GROUP BY dictionaries.id
ORDER BY name;

CREATE MATERIALIZED VIEW materialized_admin_dictionaries_view AS
SELECT * FROM dictionaries_view;
CREATE UNIQUE INDEX idx_materialized_admin_dictionaries_view_id ON materialized_admin_dictionaries_view (id); -- When you refresh data for a materialized view, PostgreSQL locks the underlying tables. To avoid this, use the CONCURRENTLY option so that PostgreSQL creates a temporary updated version of the materialized view, compares two versions, and performs INSERT and UPDATE on only the differences. To use CONCURRENTLY the materialized view must have a UNIQUE index:
SELECT cron.schedule (
    'refresh-materialized_admin_dictionaries_view', -- Job name
    '0 0 * * *', -- Every day, you can re-run this SQL with a new time amount to change the frequency
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_admin_dictionaries_view $$
); -- SELECT cron.unschedule('refresh-materialized_dictionaries_view');

CREATE MATERIALIZED VIEW materialized_dictionaries_view AS
SELECT 
  id,
  url,
  name,
  alternate_names,
  gloss_languages,
  location,
  coordinates,
  iso_639_3,
  glottocode,
  public,
  metadata,
  con_language_description,
  entry_count
FROM dictionaries_view;
-- DROP MATERIALIZED VIEW materialized_dictionaries_view

CREATE UNIQUE INDEX idx_materialized_dictionaries_view_id ON materialized_dictionaries_view (id); -- When you refresh data for a materialized view, PostgreSQL locks the underlying tables. To avoid this, use the CONCURRENTLY option so that PostgreSQL creates a temporary updated version of the materialized view, compares two versions, and performs INSERT and UPDATE on only the differences. To use CONCURRENTLY the materialized view must have a UNIQUE index:

SELECT cron.schedule (
    'refresh-materialized_dictionaries_view', -- Job name
    '0 * * * *', -- Every hour, you can re-run this SQL with a new time amount to change the frequency
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_dictionaries_view $$
); -- SELECT cron.unschedule('refresh-materialized_dictionaries_view');


CREATE VIEW profiles_view AS
SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' AS full_name,
    raw_user_meta_data->>'avatar_url' AS avatar_url
FROM auth.users;
REVOKE ALL ON public.profiles_view FROM anon, authenticated, public;

CREATE TABLE user_data (
  id uuid references auth.users not null primary key ON DELETE CASCADE,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  welcome_email_sent timestamp with time zone,
  unsubscribed_from_emails timestamp with time zone,
  terms_agreement timestamp with time zone
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their user_data." 
ON user_data FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their user_data." 
ON user_data FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  result INT;
BEGIN
  INSERT INTO public.user_data (id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE handle_new_user();


CREATE POLICY "Users can create dictionaries."
ON dictionaries FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = created_by 
    AND auth.uid() = updated_by 
    AND length(id) >= 3
);

CREATE TYPE role_enum AS ENUM ('manager', 'contributor');

CREATE TABLE dictionary_roles (
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid(),
  role role_enum NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  invited_by uuid REFERENCES auth.users,
  PRIMARY KEY (dictionary_id, user_id, role)
);

ALTER TABLE dictionary_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and contributors can view dictionary roles."
ON dictionary_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE FUNCTION add_manager_on_new_dictionary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.dictionary_roles (dictionary_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'manager');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_dictionary_created
AFTER INSERT ON public.dictionaries
FOR EACH ROW EXECUTE PROCEDURE add_manager_on_new_dictionary();

CREATE POLICY "Managers can remove contributors."
ON dictionary_roles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_roles.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Managers can update dictionaries."
ON dictionaries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionaries.id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE VIEW dictionary_roles_with_profiles AS
SELECT 
  dictionary_roles.dictionary_id,
  dictionary_roles.user_id,
  dictionary_roles.role,
  profiles_view.full_name,
  profiles_view.avatar_url
FROM dictionary_roles
JOIN profiles_view ON dictionary_roles.user_id = profiles_view.id;

CREATE TYPE status_enum AS ENUM ('queued', 'sent', 'claimed', 'cancelled');

CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  inviter_email text NOT NULL,
  target_email text NOT NULL,
  role role_enum NOT NULL,
  status status_enum NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users default auth.uid()
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can do everything on invites."
ON invites FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = invites.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = invites.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Invited users can view their invites."
ON invites FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'email' = invites.target_email
);

CREATE POLICY "Invited users can mark their invites claimed."
ON invites FOR UPDATE
TO authenticated
USING (auth.jwt() ->> 'email' = invites.target_email);

CREATE POLICY "Invited users can add themselves to the dictionary roles."
ON dictionary_roles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM invites
    WHERE invites.dictionary_id = dictionary_roles.dictionary_id
      AND invites.role = dictionary_roles.role
      AND invites.target_email = auth.jwt() ->> 'email'
      AND invites.status = 'sent'
  )
);

CREATE TABLE dictionary_info (
  id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  about text,
  grammar text,
  citation text,
  write_in_collaborators text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users default auth.uid(),
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users default auth.uid(),
  PRIMARY KEY (id)
);

ALTER TABLE dictionary_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can insert dictionary info."
ON dictionary_info FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_info.id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Managers can update dictionary info."
ON dictionary_info FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_info.id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Anyone can view dictionary info."
ON dictionary_info FOR SELECT
USING (true);

------------------------

CREATE TABLE dictionary_partners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  name text NOT NULL,
  photo_id uuid REFERENCES photos,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users default auth.uid(),
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users default auth.uid()
);

ALTER TABLE dictionary_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can add, edit, remove dictionary partners."
ON dictionary_partners FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_partners.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dictionary_roles
    WHERE dictionary_roles.dictionary_id = dictionary_partners.dictionary_id
      AND dictionary_roles.user_id = auth.uid()
      AND dictionary_roles.role = 'manager'
  )
);

CREATE POLICY "Anyone can view dictionary partners."
ON dictionary_partners FOR SELECT
USING (true);

CREATE OR REPLACE FUNCTION get_my_claim(claim TEXT) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  	coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' -> claim, null)
$$;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
    LANGUAGE sql STABLE
    AS $$
  SELECT coalesce(get_my_claim('admin')::numeric, 0) > 0
$$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('
            CREATE POLICY "Admin level 1 can perform any action on %I"
            ON %I FOR ALL
            TO authenticated
            USING (is_admin())
            WITH CHECK (is_admin());
        ', r.tablename, r.tablename);
    END LOOP;
END $$;


--- entries views ---

-- DROP FUNCTION entries_from_timestamp(timestamp with time zone, text) CASCADE; -- must drop and recreate if changing the shape of the function
CREATE FUNCTION entries_from_timestamp(
  get_newer_than timestamp with time zone,
  dict_id text
) RETURNS TABLE(
  id text,
  dictionary_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  deleted timestamp with time zone,
  main jsonb,
  senses jsonb,
  audios jsonb,
  dialect_ids jsonb,
  tag_ids jsonb
) AS $$
  WITH aggregated_audio AS (
    SELECT
      audio.entry_id,
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', audio.id,
            'storage_path', audio.storage_path,
            'source', audio.source,
            'speaker_ids', audio_speakers.speaker_ids
          )
        )
      ORDER BY audio.created_at) AS audios
    FROM audio
    LEFT JOIN (
      SELECT
        audio_id,
        jsonb_agg(speaker_id) AS speaker_ids
      FROM audio_speakers
      WHERE deleted IS NULL
      GROUP BY audio_id
    ) AS audio_speakers ON audio_speakers.audio_id = audio.id
    WHERE audio.deleted IS NULL
    GROUP BY audio.entry_id
  )
  SELECT
    entries.id AS id,
    entries.dictionary_id AS dictionary_id,
    entries.created_at,
    entries.updated_at,
    entries.deleted,
    jsonb_strip_nulls(
      jsonb_build_object(
        'lexeme', entries.lexeme,
        'phonetic', entries.phonetic,
        'interlinearization', entries.interlinearization,
        'morphology', entries.morphology,
        'notes', entries.notes,
        'sources', entries.sources,
        'scientific_names', entries.scientific_names,
        'coordinates', entries.coordinates,
        'unsupported_fields', entries.unsupported_fields,
        'elicitation_id', entries.elicitation_id
      )
    ) AS main,
    CASE 
      WHEN COUNT(senses.id) > 0 THEN jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', senses.id,
            'glosses', senses.glosses,
            'parts_of_speech', senses.parts_of_speech,
            'semantic_domains', senses.semantic_domains,
            'write_in_semantic_domains', senses.write_in_semantic_domains,
            'noun_class', senses.noun_class,
            'definition', senses.definition,
            'plural_form', senses.plural_form,
            'variant', senses.variant,
            'sentence_ids', sentence_ids,
            'photo_ids', photo_ids,
            'video_ids', video_ids
          )
        )
        ORDER BY senses.created_at
      )
      ELSE NULL
    END AS senses,
    aggregated_audio.audios,
    dialect_ids.dialect_ids,
    tag_ids.tag_ids
  FROM entries
  LEFT JOIN senses ON senses.entry_id = entries.id AND senses.deleted IS NULL
  LEFT JOIN aggregated_audio ON aggregated_audio.entry_id = entries.id
  LEFT JOIN (
    SELECT
      entry_id,
      jsonb_agg(dialect_id) AS dialect_ids
    FROM entry_dialects
    WHERE deleted IS NULL
    GROUP BY entry_id
  ) AS dialect_ids ON dialect_ids.entry_id = entries.id
  LEFT JOIN (
    SELECT
      entry_id,
      jsonb_agg(tag_id) AS tag_ids
    FROM entry_tags
    WHERE deleted IS NULL
    GROUP BY entry_id
  ) AS tag_ids ON tag_ids.entry_id = entries.id
  LEFT JOIN (
    SELECT
      senses_in_sentences.sense_id,
      jsonb_agg(senses_in_sentences.sentence_id) AS sentence_ids
    FROM senses_in_sentences
    JOIN sentences ON sentences.id = senses_in_sentences.sentence_id
    WHERE sentences.deleted IS NULL AND senses_in_sentences.deleted IS NULL
    GROUP BY senses_in_sentences.sense_id
  ) AS sense_sentences ON sense_sentences.sense_id = senses.id
  LEFT JOIN (
    SELECT
      sense_photos.sense_id,
      jsonb_agg(sense_photos.photo_id) AS photo_ids
    FROM sense_photos
    JOIN photos ON photos.id = sense_photos.photo_id
    WHERE photos.deleted IS NULL AND sense_photos.deleted IS NULL
    GROUP BY sense_photos.sense_id
  ) AS aggregated_photo_ids ON aggregated_photo_ids.sense_id = senses.id
  LEFT JOIN (
    SELECT
      sense_videos.sense_id,
      jsonb_agg(sense_videos.video_id) AS video_ids
    FROM sense_videos
    JOIN videos ON videos.id = sense_videos.video_id
    WHERE videos.deleted IS NULL AND sense_videos.deleted IS NULL
    GROUP BY sense_videos.sense_id
  ) AS aggregated_video_ids ON aggregated_video_ids.sense_id = senses.id
  WHERE entries.updated_at > get_newer_than AND (dict_id = '' OR entries.dictionary_id = dict_id)
  GROUP BY entries.id, aggregated_audio.audios, dialect_ids.dialect_ids, tag_ids.tag_ids
  ORDER BY entries.updated_at ASC;
$$ LANGUAGE SQL SECURITY DEFINER;

-- duplicate of above with a different where clause for use in the entry page
CREATE FUNCTION entry_by_id(
  passed_entry_id text
) RETURNS TABLE(
  id text,
  dictionary_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  deleted timestamp with time zone,
  main jsonb,
  senses jsonb,
  audios jsonb,
  dialect_ids jsonb,
  tag_ids jsonb
) AS $$
  WITH aggregated_audio AS (
    SELECT
      audio.entry_id,
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', audio.id,
            'storage_path', audio.storage_path,
            'source', audio.source,
            'speaker_ids', audio_speakers.speaker_ids
          )
        )
      ORDER BY audio.created_at) AS audios
    FROM audio
    LEFT JOIN (
      SELECT
        audio_id,
        jsonb_agg(speaker_id) AS speaker_ids
      FROM audio_speakers
      WHERE deleted IS NULL
      GROUP BY audio_id
    ) AS audio_speakers ON audio_speakers.audio_id = audio.id
    WHERE audio.deleted IS NULL
    GROUP BY audio.entry_id
  )
  SELECT
    entries.id AS id,
    entries.dictionary_id AS dictionary_id,
    entries.created_at,
    entries.updated_at,
    entries.deleted,
    jsonb_strip_nulls(
      jsonb_build_object(
        'lexeme', entries.lexeme,
        'phonetic', entries.phonetic,
        'interlinearization', entries.interlinearization,
        'morphology', entries.morphology,
        'notes', entries.notes,
        'sources', entries.sources,
        'scientific_names', entries.scientific_names,
        'coordinates', entries.coordinates,
        'unsupported_fields', entries.unsupported_fields,
        'elicitation_id', entries.elicitation_id
      )
    ) AS main,
    CASE 
      WHEN COUNT(senses.id) > 0 THEN jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', senses.id,
            'glosses', senses.glosses,
            'parts_of_speech', senses.parts_of_speech,
            'semantic_domains', senses.semantic_domains,
            'write_in_semantic_domains', senses.write_in_semantic_domains,
            'noun_class', senses.noun_class,
            'definition', senses.definition,
            'plural_form', senses.plural_form,
            'variant', senses.variant,
            'sentence_ids', sentence_ids,
            'photo_ids', photo_ids,
            'video_ids', video_ids
          )
        )
        ORDER BY senses.created_at
      )
      ELSE NULL
    END AS senses,
    aggregated_audio.audios,
    dialect_ids.dialect_ids,
    tag_ids.tag_ids
  FROM entries
  LEFT JOIN senses ON senses.entry_id = entries.id AND senses.deleted IS NULL
  LEFT JOIN aggregated_audio ON aggregated_audio.entry_id = entries.id
  LEFT JOIN (
    SELECT
      entry_id,
      jsonb_agg(dialect_id) AS dialect_ids
    FROM entry_dialects
    WHERE deleted IS NULL
    GROUP BY entry_id
  ) AS dialect_ids ON dialect_ids.entry_id = entries.id
  LEFT JOIN (
    SELECT
      entry_id,
      jsonb_agg(tag_id) AS tag_ids
    FROM entry_tags
    WHERE deleted IS NULL
    GROUP BY entry_id
  ) AS tag_ids ON tag_ids.entry_id = entries.id
  LEFT JOIN (
    SELECT
      senses_in_sentences.sense_id,
      jsonb_agg(senses_in_sentences.sentence_id) AS sentence_ids
    FROM senses_in_sentences
    JOIN sentences ON sentences.id = senses_in_sentences.sentence_id
    WHERE sentences.deleted IS NULL AND senses_in_sentences.deleted IS NULL
    GROUP BY senses_in_sentences.sense_id
  ) AS sense_sentences ON sense_sentences.sense_id = senses.id
  LEFT JOIN (
    SELECT
      sense_photos.sense_id,
      jsonb_agg(sense_photos.photo_id) AS photo_ids
    FROM sense_photos
    JOIN photos ON photos.id = sense_photos.photo_id
    WHERE photos.deleted IS NULL AND sense_photos.deleted IS NULL
    GROUP BY sense_photos.sense_id
  ) AS aggregated_photo_ids ON aggregated_photo_ids.sense_id = senses.id
  LEFT JOIN (
    SELECT
      sense_videos.sense_id,
      jsonb_agg(sense_videos.video_id) AS video_ids
    FROM sense_videos
    JOIN videos ON videos.id = sense_videos.video_id
    WHERE videos.deleted IS NULL AND sense_videos.deleted IS NULL
    GROUP BY sense_videos.sense_id
  ) AS aggregated_video_ids ON aggregated_video_ids.sense_id = senses.id
  WHERE entries.id = passed_entry_id
  GROUP BY entries.id, aggregated_audio.audios, dialect_ids.dialect_ids, tag_ids.tag_ids
  ORDER BY entries.updated_at ASC;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Entries loading plan:
-- When Jim loads entries for the first time on client, the client and NOT the view needs to check WHERE entries.deleted IS NULL. Then in the future if Bob deletes 1 entry, and Jim visits again, Jim will have 20 cached entries. He then loads fresh entries without the WHERE entries.deleted IS NULL when he comes today so that he gets Bob's deleted change. Then Jim's knows to remove that deleted entry from the cache

-- use entries_from_timestamp rpc function in app to get entries in a more efficient manner but still keeping the view that calls the function for easy dashboard inspection
-- DROP VIEW IF EXISTS entries_view;
CREATE VIEW entries_view AS
SELECT * FROM entries_from_timestamp('1970-01-01 01:00:00+00', ''); 

-- DROP MATERIALIZED VIEW IF EXISTS materialized_entries_view CASCADE;
CREATE MATERIALIZED VIEW materialized_entries_view AS
SELECT * FROM entries_from_timestamp('1970-01-01 01:00:00+00', ''); 

CREATE UNIQUE INDEX idx_materialized_entries_view_id ON materialized_entries_view (id); -- When you refresh data for a materialized view, PostgreSQL locks the underlying tables. To avoid this, use the CONCURRENTLY option so that PostgreSQL creates a temporary updated version of the materialized view, compares two versions, and performs INSERT and UPDATE on only the differences. To use CONCURRENTLY the materialized view must have a UNIQUE index:
REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_entries_view;

CREATE INDEX idx_materialized_entries_view_updated_at_dictionary_id 
ON materialized_entries_view (updated_at, dictionary_id);

SELECT cron.schedule (
    'refresh-materialized_entries_view', -- Job name
    '0 * * * *', -- Every hour, you can re-run this SQL with a new time amount to change the frequency
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY materialized_entries_view $$
); -- SELECT cron.unschedule('refresh-materialized_entries_view');


--- auto modify timestamps ---

create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on dictionaries
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on user_data
  for each row execute procedure moddatetime (updated_at);

CREATE FUNCTION users_for_admin_table()
RETURNS TABLE (
    id uuid,
    email text,
    full_name text,
    avatar_url text,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    unsubscribed_from_emails timestamp with time zone,
    updated_at timestamp with time zone
) AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        auth.users.id,
        auth.users.email::text,
        auth.users.raw_user_meta_data->>'full_name' AS full_name,
        auth.users.raw_user_meta_data->>'avatar_url' AS avatar_url,
        auth.users.last_sign_in_at,
        auth.users.created_at,
        user_data.unsubscribed_from_emails,
        COALESCE(user_data.updated_at, auth.users.last_sign_in_at) AS updated_at
    FROM auth.users
    LEFT JOIN user_data ON auth.users.id = user_data.id
    GROUP BY auth.users.id, user_data.unsubscribed_from_emails, user_data.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;