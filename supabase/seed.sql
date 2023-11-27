-- text field, first entry, first sense
INSERT INTO entry_updates (
  id, 
  user_id, 
  dictionary_id, 
  entry_id, 
  "table", 
  "row", 
  "column", 
  new_value, 
  old_value
 )
VALUES (
  '00000000-bbbb-cccc-dddd-eeeeeefff001',
  'user123',
  'dictionary123',
  'entry123',
  'senses',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001',
  'noun_class',
  '2',
  '1'
);

-- text[] field, same entry, same sense
INSERT INTO entry_updates (
  id, 
  user_id, 
  dictionary_id, 
  entry_id, 
  "table", 
  "row", 
  "column", 
  new_value, 
  old_value
 )
VALUES (
  '00000000-bbbb-cccc-dddd-eeeeeefff002',
  'user123',
  'dictionary123',
  'entry123',
  'senses',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff001',
  'parts_of_speech',
  '{n, v}',
  null
);

-- jsonb field, same entry, second sense
INSERT INTO entry_updates (
  id, 
  user_id, 
  dictionary_id, 
  entry_id, 
  "table", 
  "row", 
  "column", 
  new_value, 
  old_value
 )
VALUES (
  '00000000-bbbb-cccc-dddd-eeeeeefff003',
  'user123',
  'dictionary123',
  'entry123',
  'senses',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff002',
  'glosses',
  '{"en":"Hi","es":"Hola"}',
  null
);

-- jsonb field, same entry, third sense (dup data to have something to delete)
INSERT INTO entry_updates (
  id, 
  user_id, 
  dictionary_id, 
  entry_id, 
  "table", 
  "row", 
  "column", 
  new_value, 
  old_value
 )
VALUES (
  '00000000-bbbb-cccc-dddd-eeeeeefff004',
  'user123',
  'dictionary123',
  'entry123',
  'senses',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff003',
  'glosses',
  '{"en":"Hi","es":"Hola"}',
  null
);

-- timestamp field, same entry, third sense to delete
INSERT INTO entry_updates (
  id, 
  user_id, 
  dictionary_id, 
  entry_id, 
  "table", 
  "row", 
  "column", 
  new_value, 
  old_value
 )
VALUES (
  '00000000-bbbb-cccc-dddd-eeeeeefff005',
  'user123',
  'dictionary123',
  'entry123',
  'senses',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff003',
  'deleted',
  '2023-11-16T07:13:48.267Z',
  null
);

-- second entry, first sense
INSERT INTO entry_updates (
  id, 
  user_id, 
  dictionary_id, 
  entry_id, 
  "table", 
  "row", 
  "column", 
  new_value, 
  old_value
 )
VALUES (
  '00000000-bbbb-cccc-dddd-eeeeeefff006',
  'user123',
  'dictionary123',
  'entry124',
  'senses',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeefff011',
  'noun_class',
  'animals',
  'colors'
);