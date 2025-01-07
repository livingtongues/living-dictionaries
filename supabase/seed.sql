INSERT INTO auth.users ("aud", "email", "id", "instance_id", "role") VALUES
('authenticated', 'jacob@livingtongues.org', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', '00000000-0000-0000-0000-000000000000', 'authenticated'),
('authenticated', 'diego@livingtongues.org', 'be43b1dd-6c64-494d-b5da-10d70c384433', '00000000-0000-0000-0000-000000000000', 'authenticated');

INSERT INTO "public"."dictionaries" ("id", "name", "created_at", "created_by", "updated_at", "updated_by") VALUES
('test', 'Test Dictionary', '2024-03-18 14:16:22.367188+00', 'de2d3715-6337-45a3-a81a-d82c3210b2a7', '2024-03-18 14:16:22.367188+00', 'de2d3715-6337-45a3-a81a-d82c3210b2a7');