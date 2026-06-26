CREATE TYPE user_role AS ENUM ('data-admin', 'dev-admin');

CREATE TABLE user_profiles (
  id uuid references auth.users (id) primary key NOT NULL,
  name text NOT NULL,
  role user_role,
  agree_to_terms timestamp with time zone,
  unsubscribe_from_announcements timestamp with time zone,
);

-- TODO: add editors table to store managers and contributors

CREATE TABLE dictionaries (
  id text unique primary key NOT NULL,
  CONSTRAINT proper_dictionary_id CHECK (id ~ '^[a-zA-Z0-9_-]+$'),
  CONSTRAINT dictionary_id_length CHECK (char_length(id) > 2 and char_length(id) <= 20),
);

CREATE TABLE dictionary_updates (

);