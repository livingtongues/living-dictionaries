-- Seed data for testing the admin route
-- Run with: pnpm supabase db reset (this will also run seed.sql)

-- Create test users in auth.users (Supabase handles user_data creation via trigger)
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, last_sign_in_at, instance_id, aud, role, confirmation_token, recovery_token, email_change_token_new, email_change) VALUES
  ('de2d3715-6337-45a3-a81a-d82c3210b2a7', 'jacob@livingtongues.org', '{"full_name": "Jacob Bowdoin", "avatar_url": "https://i.pravatar.cc/150?u=jacob"}', NOW() - INTERVAL '2 years', NOW() - INTERVAL '1 day', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', '', '', ''),
  ('be43b1dd-6c64-494d-b5da-10d70c384433', 'diego@livingtongues.org', '{"full_name": "Diego García", "avatar_url": "https://i.pravatar.cc/150?u=diego"}', NOW() - INTERVAL '18 months', NOW() - INTERVAL '3 days', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', '', '', ''),
  ('11111111-1111-1111-1111-111111111111', 'maria@example.com', '{"full_name": "Maria Santos", "avatar_url": "https://i.pravatar.cc/150?u=maria"}', NOW() - INTERVAL '1 year', NOW() - INTERVAL '1 week', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222', 'alex@example.com', '{"full_name": "Alex Chen", "avatar_url": "https://i.pravatar.cc/150?u=alex"}', NOW() - INTERVAL '6 months', NOW() - INTERVAL '2 weeks', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', '', '', ''),
  ('33333333-3333-3333-3333-333333333333', 'unsubscribed@example.com', '{"full_name": "Unsubscribed User"}', NOW() - INTERVAL '3 months', NOW() - INTERVAL '1 month', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', '', '', ''),
  ('44444444-4444-4444-4444-444444444444', 'newuser@example.com', '{"full_name": "New User"}', NOW() - INTERVAL '1 week', NULL, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', '', '', '');

-- Mark one user as unsubscribed from emails
UPDATE user_data SET unsubscribed_from_emails = NOW() - INTERVAL '2 weeks' WHERE id = '33333333-3333-3333-3333-333333333333';

-- Create test dictionaries with various states
INSERT INTO dictionaries (id, url, name, gloss_languages, public, iso_639_3, glottocode, location, alternate_names, coordinates, language_used_by_community, community_permission, author_connection, con_language_description, created_at, created_by, updated_at, updated_by) VALUES
  ('tuvan', 'tuvan', 'Tuvan Dictionary', '{en,ru}', true, 'tyv', 'tuvi1240', 'Tuva Republic, Russia', '{"Tyvan", "Tuvinian"}', '{"points": [{"coordinates": {"latitude": 51.7191, "longitude": 94.4378}}]}', true, 'yes', 'Community partnership with Tuvan speakers', NULL, NOW() - INTERVAL '2 years', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', NOW() - INTERVAL '1 month', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  ('siletz', 'siletz', 'Siletz Dee-ni Dictionary', '{en}', true, 'slt', 'sile1253', 'Oregon, USA', '{"Siletz Dee-ni", "Athabaskan"}', '{"points": [{"coordinates": {"latitude": 44.7207, "longitude": -123.9218}}]}', true, 'yes', 'Partnership with Siletz Tribal community', NULL, NOW() - INTERVAL '18 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', NOW() - INTERVAL '2 weeks', 'be43b1dd-6c64-494d-b5da-10d70c384433'),
  ('klingon', 'klingon', 'tlhIngan Hol', '{en}', false, NULL, NULL, 'Qo''noS', '{"Klingon"}', NULL, false, 'no', 'Fan-created constructed language', 'YES', NOW() - INTERVAL '1 year', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '3 months', '11111111-1111-1111-1111-111111111111'),
  ('sindarin', 'sindarin', 'Sindarin Elvish', '{en}', false, NULL, NULL, 'Middle-earth', '{"Elvish", "Grey-elven"}', NULL, false, 'no', 'Tolkien linguistic research', 'YES', NOW() - INTERVAL '8 months', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '1 week', '22222222-2222-2222-2222-222222222222'),
  ('quechua', 'quechua-test', 'Quechua Test Dictionary', '{en,es}', false, 'que', 'quec1387', 'Peru', '{"Runasimi", "Quichua"}', '{"points": [{"coordinates": {"latitude": -13.5319, "longitude": -71.9675}}]}', true, 'unknown', 'Working with local communities', NULL, NOW() - INTERVAL '6 months', 'be43b1dd-6c64-494d-b5da-10d70c384433', NOW() - INTERVAL '5 days', 'be43b1dd-6c64-494d-b5da-10d70c384433'),
  ('empty-dict', 'empty-dictionary', 'Empty Test Dictionary', '{en}', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW() - INTERVAL '1 week', '44444444-4444-4444-4444-444444444444', NOW() - INTERVAL '1 week', '44444444-4444-4444-4444-444444444444');

-- Add dictionary roles (managers and contributors)
-- Note: The trigger adds creator as manager automatically, so we add additional roles here
INSERT INTO dictionary_roles (dictionary_id, user_id, role, created_at, invited_by) VALUES
  -- Siletz: Diego is contributor (Jacob is manager via trigger)
  ('siletz', 'be43b1dd-6c64-494d-b5da-10d70c384433', 'contributor', NOW() - INTERVAL '1 year', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  -- Tuvan: Maria is contributor
  ('tuvan', '11111111-1111-1111-1111-111111111111', 'contributor', NOW() - INTERVAL '6 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  -- Quechua: Jacob is also a contributor
  ('quechua', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', 'contributor', NOW() - INTERVAL '3 months', 'be43b1dd-6c64-494d-b5da-10d70c384433'),
  -- Klingon: Alex is contributor
  ('klingon', '22222222-2222-2222-2222-222222222222', 'contributor', NOW() - INTERVAL '6 months', '11111111-1111-1111-1111-111111111111');

-- Add invites with various statuses
INSERT INTO invites (id, dictionary_id, inviter_email, target_email, role, status, created_at, created_by) VALUES
  -- Pending invite for Tuvan
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tuvan', 'jacob@livingtongues.org', 'pending@example.com', 'contributor', 'sent', NOW() - INTERVAL '1 week', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  -- Queued invite for Siletz
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'siletz', 'jacob@livingtongues.org', 'queued@example.com', 'manager', 'queued', NOW() - INTERVAL '2 days', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  -- Claimed invite for Quechua (Maria claimed it)
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'quechua', 'diego@livingtongues.org', 'maria@example.com', 'contributor', 'claimed', NOW() - INTERVAL '3 months', 'be43b1dd-6c64-494d-b5da-10d70c384433'),
  -- Cancelled invite
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'tuvan', 'jacob@livingtongues.org', 'cancelled@example.com', 'contributor', 'cancelled', NOW() - INTERVAL '2 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');

-- Add some sample entries to make entry_count show up in the view
INSERT INTO entries (id, dictionary_id, lexeme, created_at, created_by, updated_at, updated_by) VALUES
  -- Tuvan entries
  ('tuvan-1', 'tuvan', '{"default": "хой"}', NOW() - INTERVAL '1 year', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', NOW() - INTERVAL '1 month', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  ('tuvan-2', 'tuvan', '{"default": "аът"}', NOW() - INTERVAL '11 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', NOW() - INTERVAL '2 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  ('tuvan-3', 'tuvan', '{"default": "суг"}', NOW() - INTERVAL '10 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', NOW() - INTERVAL '3 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  -- Siletz entries
  ('siletz-1', 'siletz', '{"default": "shaa"}', NOW() - INTERVAL '1 year', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', NOW() - INTERVAL '1 month', 'be43b1dd-6c64-494d-b5da-10d70c384433'),
  ('siletz-2', 'siletz', '{"default": "chit"}', NOW() - INTERVAL '10 months', 'be43b1dd-6c64-494d-b5da-10d70c384433', NOW() - INTERVAL '2 weeks', 'be43b1dd-6c64-494d-b5da-10d70c384433'),
  -- Klingon entries
  ('klingon-1', 'klingon', '{"default": "Qapla''"}', NOW() - INTERVAL '8 months', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '4 months', '11111111-1111-1111-1111-111111111111'),
  ('klingon-2', 'klingon', '{"default": "nuqneH"}', NOW() - INTERVAL '7 months', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '3 months', '22222222-2222-2222-2222-222222222222'),
  -- Quechua entry
  ('quechua-1', 'quechua', '{"default": "yaku"}', NOW() - INTERVAL '5 months', 'be43b1dd-6c64-494d-b5da-10d70c384433', NOW() - INTERVAL '1 month', 'be43b1dd-6c64-494d-b5da-10d70c384433');

-- Add senses for the entries
INSERT INTO senses (id, entry_id, dictionary_id, glosses, parts_of_speech, created_at, created_by, updated_at, updated_by) VALUES
  ('11111111-0001-0001-0001-000000000001', 'tuvan-1', 'tuvan', '{"en": "sheep"}', '{"noun"}', NOW() - INTERVAL '1 year', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', NOW() - INTERVAL '1 month', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  ('11111111-0001-0001-0001-000000000002', 'tuvan-2', 'tuvan', '{"en": "horse"}', '{"noun"}', NOW() - INTERVAL '11 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', NOW() - INTERVAL '2 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  ('11111111-0001-0001-0001-000000000003', 'tuvan-3', 'tuvan', '{"en": "water", "ru": "вода"}', '{"noun"}', NOW() - INTERVAL '10 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', NOW() - INTERVAL '3 months', 'de2d3715-6337-45a3-a81a-d82c3210b2a7'),
  ('11111111-0001-0001-0001-000000000004', 'siletz-1', 'siletz', '{"en": "sun"}', '{"noun"}', NOW() - INTERVAL '1 year', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', NOW() - INTERVAL '1 month', 'be43b1dd-6c64-494d-b5da-10d70c384433'),
  ('11111111-0001-0001-0001-000000000005', 'siletz-2', 'siletz', '{"en": "salmon"}', '{"noun"}', NOW() - INTERVAL '10 months', 'be43b1dd-6c64-494d-b5da-10d70c384433', NOW() - INTERVAL '2 weeks', 'be43b1dd-6c64-494d-b5da-10d70c384433'),
  ('11111111-0001-0001-0001-000000000006', 'klingon-1', 'klingon', '{"en": "success"}', '{"noun", "interjection"}', NOW() - INTERVAL '8 months', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '4 months', '11111111-1111-1111-1111-111111111111'),
  ('11111111-0001-0001-0001-000000000007', 'klingon-2', 'klingon', '{"en": "what do you want?"}', '{"interjection"}', NOW() - INTERVAL '7 months', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '3 months', '22222222-2222-2222-2222-222222222222'),
  ('11111111-0001-0001-0001-000000000008', 'quechua-1', 'quechua', '{"en": "water", "es": "agua"}', '{"noun"}', NOW() - INTERVAL '5 months', 'be43b1dd-6c64-494d-b5da-10d70c384433', NOW() - INTERVAL '1 month', 'be43b1dd-6c64-494d-b5da-10d70c384433');

-- Refresh the materialized views so the data appears immediately
REFRESH MATERIALIZED VIEW materialized_dictionaries_view;
REFRESH MATERIALIZED VIEW materialized_admin_dictionaries_view;
