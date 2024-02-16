INSERT INTO auth.users ("aud", "email", "id", "instance_id", "role") VALUES
('authenticated', 'seeded@mock.com', '12345678-abcd-efab-cdef-123456789012', '00000000-0000-0000-0000-000000000000', 'authenticated');

INSERT INTO entry_updates ("column", "dictionary_id", "entry_id", "id", "new_value", "old_value", "row", "table", "user_id") VALUES
('noun_class', 'dictionary1', 'entry1', '3e6dcbe2-1fbd-46d9-98ba-ec26e12bbf2c', '2', '1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('parts_of_speech', 'dictionary1', 'entry1', '4dee9c88-8302-4274-90f1-dd1e9cf98b73', '{n, v}', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('glosses', 'dictionary1', 'entry1', '9466e6b1-7a5f-4a87-907d-182497a5f7f3', '{"en":"Hi","es":"Hola"}', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff002', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('glosses', 'dictionary1', 'entry1', '2e50e69a-5a3f-417b-adaa-68beb9b84499', '{"en":"Hi","es":"Hola"}', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff003', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('deleted', 'dictionary1', 'entry1', 'c7dfaff3-e0a7-40e5-b920-11cd76d9894b', '2023-11-16T07:13:48.267Z', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff003', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('noun_class', 'dictionary1', 'entry2', '750a3e60-e26e-4f5f-8717-8d70ef44b8d6', 'animals', 'colors', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff011', 'senses', '12345678-abcd-efab-cdef-123456789012');
