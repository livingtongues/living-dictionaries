INSERT INTO auth.users (
instance_id,
id,
aud,
role,
email,
email_confirmed_at,
last_sign_in_at,
raw_app_meta_data,
raw_user_meta_data,
created_at,
updated_at
) VALUES ('00000000-0000-0000-0000-000000000000', /* instance_id */
  uuid_generate_v4(), /* id */
  'authenticated', /* aud character varying(255),*/
  'authenticated', /* role character varying(255),*/
  'robert@me.org', /* email character varying(255),*/
  NOW(), /* email_confirmed_at timestamp with time zone,*/
  '2023-06-08 04:42:14.0001+00', /* last_sign_in_at timestamp with time zone, */
  '{"provider": "email","providers":["email"]}', /* raw_app_meta_data jsonb,*/
  '{}', /* raw_user_meta_data jsonb,*/
  '2023-06-08 04:42:14.0001+00', /* created_at timestamp with time zone, */
  NOW() /* updated_at timestamp with time zone, */),
('00000000-0000-0000-0000-000000000000', /* instance_id */
  uuid_generate_v4(), /* id */
  'authenticated', /* aud character varying(255),*/
  'authenticated', /* role character varying(255),*/
  'bob@gmail.com', /* email character varying(255),*/
  NOW(), /* email_confirmed_at timestamp with time zone,*/
  '2021-03-12 21:04:29.0001+00', /* last_sign_in_at timestamp with time zone, */
  '{"provider": "google","providers":["google"]}', /* raw_app_meta_data jsonb,*/
  '{"displayName": "Bob D''Smith","photoURL":"https://lh3.googleusercontent.com/a-/AOh14Gg-GMlUaNPYaSYvzMEjyHW9Q5PAngePLc26LsI4=s96-c"}', /* raw_user_meta_data jsonb,*/
  '2020-12-29 00:08:26.0001+00', /* created_at timestamp with time zone, */
  NOW() /* updated_at timestamp with time zone, */) ON CONFLICT DO NOTHING;