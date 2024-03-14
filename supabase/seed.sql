INSERT INTO auth.users ("aud", "email", "id", "instance_id", "role") VALUES
('authenticated', 'seeded@mock.com', '12345678-abcd-efab-cdef-123456789012', '00000000-0000-0000-0000-000000000000', 'authenticated');

INSERT INTO dictionaries ("created_by", "id", "name", "updated_by") VALUES
('12345678-abcd-efab-cdef-123456789012', 'dictionary1', 'Test Dictionary', '12345678-abcd-efab-cdef-123456789012');

INSERT INTO entry_updates ("column", "dictionary_id", "entry_id", "id", "new_value", "old_value", "row", "table", "user_id") VALUES
('noun_class', 'dictionary1', 'entry1', '11111111-1111-1111-1111-111111111101', '2', '1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001', 'senses', 'seeded@mock.com'),
('parts_of_speech', 'dictionary1', 'entry1', '11111111-1111-1111-1111-111111111102', '{n, v}', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('glosses', 'dictionary1', 'entry1', '11111111-1111-1111-1111-111111111103', '{"en":"Hi","es":"Hola"}', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff002', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('glosses', 'dictionary1', 'entry1', '11111111-1111-1111-1111-111111111104', '{"en":"Hi","es":"Hola"}', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff003', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('deleted', 'dictionary1', 'entry1', '11111111-1111-1111-1111-111111111105', '2023-11-16T07:13:48.267Z', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff003', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('noun_class', 'dictionary1', 'entry2', '11111111-1111-1111-1111-111111111106', 'animals', 'colors', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff011', 'senses', '12345678-abcd-efab-cdef-123456789012');
