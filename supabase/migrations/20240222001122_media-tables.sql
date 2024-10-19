CREATE TABLE photos (
  id uuid primary key default uuid_generate_v4(),
  -- added dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  storage_path text NOT NULL,
  serving_url text NOT NULL,
  source text,
  photographer text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE videos (
  id uuid primary key default uuid_generate_v4(),
  -- added dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
  storage_path text NOT NULL, -- made nullable and added hosted_elsewhere column
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
  -- added dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
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
  -- added dictionary_id text NOT NULL REFERENCES dictionaries ON DELETE CASCADE,
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