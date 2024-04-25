import { error, json } from '@sveltejs/kit'
import type { MultiString } from '@living-dictionaries/types'
import type { RequestHandler } from './$types'
import { checkForPermission } from './check-dictionary-permission'
import { decodeToken } from '$lib/server/firebase-admin'
import { getAdminSupabaseClient } from '$lib/supabase/admin'
import { ResponseCodes } from '$lib/constants'
import type { Database, TablesInsert } from '$lib/supabase/generated.types'
import { dev } from '$app/environment'

export interface ContentUpdateRequestBody {
  id: string // id of the change, a uuidv4 created on client to make things idempotent
  user_id_from_local?: string
  auth_token: string
  dictionary_id: string
  entry_id?: string
  sense_id?: string
  sentence_id?: string
  text_id?: string
  audio_id?: string
  video_id?: string
  photo_id?: string
  speaker_id?: string
  table: Database['public']['Enums']['content_tables']
  change: {
    sense?: {
      glosses?: {
        new: MultiString
        old?: MultiString
      }
      definition?: {
        new: MultiString
        old?: MultiString
      }
      noun_class?: {
        new: string
        old?: string
      }
      parts_of_speech?: {
        new: string[]
        old?: string[]
      }
      semantic_domains?: {
        new: string[]
        old?: string[]
      }
      write_in_semantic_domains?: {
        new: string[]
        old?: string[]
      }
      deleted?: boolean
    }
    sentence?: {
      text?: {
        new: MultiString
        old?: MultiString
      }
      translation?: {
        new: MultiString
        old?: MultiString
      }
      removed_from_sense?: boolean // currently also deletes the sentence - later when a sentence can be connected to multiple sentences, use a deleted field to indicate the sentence is deleted everywhere
      // deleted?: boolean;
    }
  }
  import_id?: string
  timestamp: string
}

export type ContentUpdateResponseBody = TablesInsert<'content_updates'>

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { id, user_id_from_local, auth_token, table, dictionary_id, audio_id, entry_id, photo_id, speaker_id, text_id, video_id, sentence_id, sense_id, change, import_id, timestamp } = await request.json() as ContentUpdateRequestBody

    if (audio_id)
      throw new Error('audio_id change not implemented')
    if (speaker_id)
      throw new Error('speaker_id change not implemented')
    if (photo_id)
      throw new Error('photo_id change not implemented')
    if (video_id)
      throw new Error('video_id change not implemented')
    if (text_id)
      throw new Error('text_id change not implemented')

    const adminSupabase = getAdminSupabaseClient()

    let user_id = user_id_from_local
    const is_deployed = !dev
    if (is_deployed) {
      const decodedToken = await decodeToken(auth_token)
      if (!decodedToken?.uid)
        throw new Error('No user id found in token')

      await checkForPermission(decodedToken.uid, dictionary_id)
      user_id = decodedToken.uid
      const { data } = await adminSupabase.from('user_emails')
        .select('id')
        .eq('email', decodedToken.email)
        .single()
      if (!data?.id)
        throw new Error('No user id found in database')
      user_id = data.id
    }

    if (!user_id)
      throw new Error('No user id found. Pass it into the user_id_from_local field or use a valid auth_token.')

    const { data: dictionary } = await adminSupabase.from('dictionaries').select().eq('id', dictionary_id).single()
    if (!dictionary) {
      const { error: add_dictionary_error } = await adminSupabase.from('dictionaries').insert({
        id: dictionary_id,
        name: 'CHANGE',
        created_by: user_id,
        updated_by: user_id,
      })
      if (add_dictionary_error)
        throw new Error(add_dictionary_error.message)
    }

    if (table === 'senses') {
      const sense: TablesInsert<'senses'> = {
        id: sense_id,
        entry_id,
        created_by: user_id, // Postgres trigger will keep this from being changed on update operations
        updated_by: user_id,
      }

      if (change.sense.glosses)
        sense.glosses = change.sense.glosses.new
      if (change.sense.noun_class)
        sense.noun_class = change.sense.noun_class.new
      if (change.sense.parts_of_speech)
        sense.parts_of_speech = change.sense.parts_of_speech.new
      if (change.sense.semantic_domains)
        sense.semantic_domains = change.sense.semantic_domains.new
      if (change.sense.write_in_semantic_domains)
        sense.write_in_semantic_domains = change.sense.write_in_semantic_domains.new
      if (change.sense.definition)
        sense.definition = change.sense.definition.new
      if (change.sense.deleted)
        sense.deleted = timestamp

      const { error: update_error } = await adminSupabase.from('senses')
        .upsert(sense)
      if (update_error)
        throw new Error(update_error.message)
    }

    if (table === 'sentences') {
      const sentence: TablesInsert<'sentences'> = {
        id: sentence_id,
        dictionary_id,
        created_by: user_id, // Postgres trigger will keep this from being changed on update operations
        updated_by: user_id,
      }

      const editing_sentence_in_sense = sentence_id && sense_id
      if (change.sentence.text)
        sentence.text = change.sentence.text.new
      if (change.sentence.translation)
        sentence.translation = change.sentence.translation.new

      const { error: update_error } = await adminSupabase.from('sentences')
        .upsert(sentence)
      if (update_error)
        throw new Error(update_error.message)

      if (editing_sentence_in_sense) {
        await adminSupabase.from('senses_in_sentences')
          .insert({
            sentence_id,
            sense_id,
            created_by: user_id,
          })
      }

      if (change.sentence.removed_from_sense) {
        if (!editing_sentence_in_sense)
          throw new Error('sentence_id and sense_id are required when removing a sentence from a sense')
        const { error: delete_error } = await adminSupabase.from('senses_in_sentences')
          .update({ deleted: timestamp })
          .eq('sentence_id', sentence_id)
          .eq('sense_id', sense_id)
        if (delete_error)
          throw new Error(delete_error.message)

        const { error: update_error } = await adminSupabase.from('sentences')
          .update({ deleted: timestamp })
          .eq('id', sentence_id)
        if (update_error)
          throw new Error(update_error.message)
      }
    }

    // Save the history state
    const { data: content_update, error: history_error } = await adminSupabase.from('content_updates').insert({
      id,
      user_id,
      dictionary_id,
      sentence_id,
      sense_id,
      timestamp,
      table,
      import_id,
      change,
    })
      .select()
      .single()

    if (history_error)
      throw new Error(history_error.message)

    return json(content_update satisfies ContentUpdateResponseBody)
  } catch (err) {
    console.error(`Error saving sentence: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error saving sentence: ${err.message}`)
  }
}
