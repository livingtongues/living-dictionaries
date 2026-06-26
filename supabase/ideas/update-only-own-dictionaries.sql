-- good to go
CREATE POLICY "Users can add entry updates as themselves"
ON entry_updates FOR INSERT to authenticated using ( auth.uid() = user_id );

-- not ready yet
CREATE POLICY "Users can add entry updates do dictionaries they manage"
ON entry_updates FOR INSERT to authenticated using (
  document_id in (
    select id
    from documents
    where owner_id = auth.uid()
  )
);

-- https://supabase.com/docs/guides/auth/row-level-security