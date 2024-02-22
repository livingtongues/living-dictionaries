INSERT INTO auth.users ("aud", "email", "id", "instance_id", "role") VALUES
('authenticated', 'seeded@mock.com', '12345678-abcd-efab-cdef-123456789012', '00000000-0000-0000-0000-000000000000', 'authenticated');

INSERT INTO entry_updates ("column", "dictionary_id", "entry_id", "id", "new_value", "old_value", "row", "table", "user_id") VALUES
('noun_class', 'dictionary1', 'entry1', '11111111-1111-1111-1111-111111111101', '2', '1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('parts_of_speech', 'dictionary1', 'entry1', '11111111-1111-1111-1111-111111111102', '{n, v}', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('glosses', 'dictionary1', 'entry1', '11111111-1111-1111-1111-111111111103', '{"en":"Hi","es":"Hola"}', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff002', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('glosses', 'dictionary1', 'entry1', '11111111-1111-1111-1111-111111111104', '{"en":"Hi","es":"Hola"}', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff003', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('deleted', 'dictionary1', 'entry1', '11111111-1111-1111-1111-111111111105', '2023-11-16T07:13:48.267Z', null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff003', 'senses', '12345678-abcd-efab-cdef-123456789012'),
('noun_class', 'dictionary1', 'entry2', '11111111-1111-1111-1111-111111111106', 'animals', 'colors', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff011', 'senses', '12345678-abcd-efab-cdef-123456789012');

INSERT INTO sentence_updates ("column", "dictionary_id", "sentence_id", "id", "new_value", "sense_id", "table", "user_id") VALUES
('text', 'dictionary1', '11111111-1111-1111-1111-1111111111a1', '11111111-1111-1111-1111-111111111107', 'Hi, I am an example sentence for the first sense of the first entry.', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001', 'sentences', '12345678-abcd-efab-cdef-123456789012'),
('translation', 'dictionary1', '11111111-1111-1111-1111-1111111111a1', '11111111-1111-1111-1111-111111111108', '{"es":"Hola, soy una oración de ejemplo para el primer sentido de la primera entrada."}', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001', 'sentences', '12345678-abcd-efab-cdef-123456789012');
