INSERT INTO everything ("array", "boolean", "int", "jsonb", "jsonb_array", "real", "text") VALUES
('{1,2}', true, 2, '{"a":{"b":1}}'::jsonb, '{"{\"a\":{\"b\":\"it''s\"}}"}'::jsonb[], 12.4, 'hello'),
('{}', false, 0, '{"array":[]}'::jsonb, null, 12.4, ''),
(null, null, null, null, null, null, null);