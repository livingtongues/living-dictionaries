export async function addAdditionalSensesToSupabase(entry_id: string, dictionary_id: string, entry: any) {
  throw new Error('not implemented')
}

// Current flow:
// Use Firebase to import entry as is already written (import-spreadsheet-v4.ts) including 1st sense, but check the import data for additional senses. If so then do the below flow at that point using a simple function call.
// use that entry id to add additional senses to Supabase via entry_updates (seen in routes\api\db\change\entry\+server.ts and lib\supabase\change\sense.ts) - one update for ps, one for gloss
// add example sentence to new table (Jacob will create, so it doesn't exist yet)
// add another entry_update to connect that example sentence id to the sense


// Future Supabase-only flow - ignore for now
// Import entry into imports table, after which a trigger edge function will create the entry, get the entry id
// use that entry id to add senses via entry_updates
// add example sentence to new table (doesn't exist yet)
// add entry_update to connect that example sentence to the sense
