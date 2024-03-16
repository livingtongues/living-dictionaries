CREATE TYPE certainty AS ENUM ('yes', 'no', 'unknown');

CREATE TABLE dictionaries ( -- TODO: migrate from Firestore
  id text unique primary key NOT NULL,
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
  created_by uuid NOT NULL REFERENCES auth.users,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users,
  deleted timestamp with time zone
);

ALTER TABLE dictionaries ENABLE ROW LEVEL SECURITY;

CREATE TABLE entries ( -- TODO: migrate from Firestore
  id text unique primary key NOT NULL, -- generated on client so users can create an entry offline and keep editing it
  dictionary_id text NOT NULL REFERENCES dictionaries,
  lexeme jsonb NOT NULL, -- MultiString
  phonetic text,
  interlinearization text,
  morphology text,
  plural_form text,
  variant text,
  dialects text[], -- TODO: remove this field by creating a dialects table and many-many table
  notes text, -- TODO: should this be a MultiString?
  sources text[],
  -- elicitation_id text, -- TODO: save as a tag when migrating onondaga
  scientific_names text[],
  coordinates jsonb, -- Coordinates
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

-- used https://drawsql.app/teams/ld-4/diagrams/entries-sentences-texts to make tables plan (max 15 tables)
-- https://dbdiagram.io/ looks useful for anything more complicated