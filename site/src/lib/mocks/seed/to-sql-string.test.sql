INSERT INTO everything ("array", "array_with_empty", "array_with_quotes", "boolean", "int", "jsonb", "jsonb_array", "real", "text") VALUES
('{1,2}', '{only I and 0 survive,0}', '{"it''s ok","it, was a \"hot\" day"}', true, 2, '{"a":{"b":1,"has_quotes":"''its"}}'::jsonb, '{"{\"a\":{\"b\":\"it''s\"}}"}'::jsonb[], 12.4, 'hello'),
('{}', null, null, false, 0, '{"array":[]}'::jsonb, null, 12.4, ''),
(null, null, null, null, null, null, null, null, null);