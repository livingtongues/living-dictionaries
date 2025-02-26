ALTER TABLE user_data
DROP CONSTRAINT user_data_id_fkey;

ALTER TABLE user_data
ADD CONSTRAINT user_data_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id)
ON DELETE CASCADE;