INSERT INTO auth.users ("aud", "created_at", "email", "email_confirmed_at", "id", "instance_id", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "role", "updated_at") VALUES
('authenticated', '2023-06-08 04:42:14.0001+00', 'robert@me.org', NOW(), uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', '2023-06-08 04:42:14.0001+00', '{"provider": "email","providers":["email"], "fb_uid": "024bvoAhcSaAiBfZ8Um2KQaQRc92"}', '{}', 'authenticated', NOW()),
('authenticated', '2020-12-29 00:08:26.0001+00', 'bob@gmail.com', null, uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', '2021-03-12 21:04:29.0001+00', '{"provider": "google","providers":["google"], "fb_uid": "0FCdmOc6qlWuKxFkKPi7VeC2mp52"}', '{"full_name": "Bob D''Smith","avatar_url":"https://lh3.googleusercontent.com/a-/AOh14Gg-GMlUaNPYaSYvzMEjyHW9Q5PAngePLc26LsI4=s96-c"}', 'authenticated', NOW()) ON CONFLICT DO NOTHING;