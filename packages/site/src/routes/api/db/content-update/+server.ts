import { json, error as kit_error } from '@sveltejs/kit'
import type { ContentUpdateRequestBody, TablesInsert } from '@living-dictionaries/types'
import type { RequestHandler } from './$types'
import { checkForPermission } from './check-dictionary-permission'
import { decodeToken } from '$lib/server/firebase-admin'
import { getAdminSupabaseClient } from '$lib/supabase/admin'
import { ResponseCodes } from '$lib/constants'
import { dev } from '$app/environment'

export type ContentUpdateResponseBody = TablesInsert<'content_updates'>

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as ContentUpdateRequestBody
    const { update_id, user_id_from_local, auth_token, dictionary_id, import_id, timestamp, type, data } = body

    const admin_supabase = getAdminSupabaseClient()

    let user_id = user_id_from_local
    const is_deployed = !dev
    if (is_deployed || auth_token) {
      const decoded_token = await decodeToken(auth_token)
      if (!decoded_token?.uid)
        throw new Error('No user id found in token')

      await checkForPermission(decoded_token.uid, dictionary_id)
      user_id = decoded_token.uid
      const { data } = await admin_supabase.from('user_emails')
        .select('id')
        .eq('email', decoded_token.email!)
        .single()
      if (!data?.id)
        throw new Error('No user id found in database')
      user_id = data.id
    }

    if (!user_id)
      throw new Error('No user id found. Pass it into the user_id_from_local field or use a valid auth_token.')

    const user_meta = {
      created_by: user_id,
      updated_by: user_id,
      created_at: timestamp,
      updated_at: timestamp,
    }

    const { data: dictionary } = await admin_supabase.from('dictionaries').select().eq('id', dictionary_id).single()
    if (!dictionary) {
      const { error } = await admin_supabase.from('dictionaries').insert({
        id: dictionary_id,
        name: 'CHANGE',
        ...user_meta,
      })
      if (error)
        throw new Error(error.message)
    }

    if (type === 'upsert_entry') {
      const { error } = await admin_supabase.from('entries')
        .upsert({
          ...user_meta,
          ...data,
          dictionary_id,
          id: body.entry_id,
          ...(data.deleted && { deleted: timestamp }),
        } as TablesInsert<'entries'>)
      if (error)
        throw new Error(error.message)
    }

    if (type === 'upsert_sense') {
      const { error } = await admin_supabase.from('senses')
        .upsert({
          ...user_meta,
          ...data,
          id: body.sense_id,
          entry_id: body.entry_id,
          ...(data.deleted && { deleted: timestamp }),
        })
      if (error)
        throw new Error(error.message)
    }

    if (type === 'upsert_dialect') {
      const { error } = await admin_supabase.from('dialects')
        .upsert({
          ...user_meta,
          ...data,
          dictionary_id,
          id: body.dialect_id,
          ...(data.deleted && { deleted: timestamp }),
        } as TablesInsert<'dialects'>)
      if (error)
        throw new Error(error.message)
    }

    if (type === 'insert_sentence' || type === 'update_sentence') {
      const { error } = await admin_supabase.from('sentences')
        .upsert({
          ...user_meta,
          ...data,
          dictionary_id,
          id: body.sentence_id,
          ...(data.deleted && { deleted: timestamp }),
        })
      if (error)
        throw new Error(error.message)
    }

    if (type === 'insert_sentence') {
      const { error } = await admin_supabase.from('senses_in_sentences')
        .insert({
          sentence_id: body.sentence_id,
          sense_id: body.sense_id,
          created_by: user_id,
        })
      if (error)
        throw new Error(error.message)
    }

    if (type === 'remove_sentence') {
      const { error: delete_error } = await admin_supabase.from('senses_in_sentences')
        .update({ deleted: timestamp })
        .eq('sentence_id', body.sentence_id)
        .eq('sense_id', body.sense_id)
      if (delete_error)
        throw new Error(delete_error.message)

      const { error: update_error } = await admin_supabase.from('sentences')
        .update({ deleted: timestamp })
        .eq('id', body.sentence_id)
      if (update_error)
        throw new Error(update_error.message)
    }

    if (type === 'upsert_audio') {
      const { error } = await admin_supabase.from('audio')
        .upsert({
          ...user_meta,
          ...data,
          id: body.audio_id,
          entry_id: body.entry_id,
          ...(data.deleted && { deleted: timestamp }),
        } as TablesInsert<'audio'>)
      if (error)
        throw new Error(error.message)
    }

    if (type === 'upsert_photo') {
      const { error } = await admin_supabase.from('photos')
        .upsert({
          ...user_meta,
          ...data,
          id: body.photo_id,
          ...(data.deleted && { deleted: timestamp }),
        } as TablesInsert<'photos'>)
      if (error)
        throw new Error(error.message)

      const { error: connect_error } = await admin_supabase.from('sense_photos')
        .insert({
          photo_id: body.photo_id,
          sense_id: body.sense_id,
          created_by: user_id,
        })
      if (connect_error)
        throw new Error(connect_error.message)
    }

    if (type === 'upsert_video') {
      const { error } = await admin_supabase.from('videos')
        .upsert({
          ...user_meta,
          ...data,
          id: body.video_id,
          ...(data.deleted && { deleted: timestamp }),
        } as TablesInsert<'videos'>)
      if (error)
        throw new Error(error.message)

      const { error: connect_error } = await admin_supabase.from('sense_videos')
        .insert({
          video_id: body.video_id,
          sense_id: body.sense_id,
          created_by: user_id,
        })
      if (connect_error)
        throw new Error(connect_error.message)
    }

    const { data: content_update, error } = await admin_supabase.from('content_updates').insert({
      id: update_id,
      user_id,
      dictionary_id,
      timestamp,
      import_id,
      change: {
        type,
        data,
      },
      // @ts-expect-error - avoiding verbosity but requires manual type checking
      ...(body.audio_id && { audio_id: body.audio_id }),
      // @ts-expect-error
      ...(body.dialect_id && { dialect_id: body.dialect_id }),
      // @ts-expect-error
      ...(body.entry_id && { entry_id: body.entry_id }),
      // @ts-expect-error
      ...(body.photo_id && { photo_id: body.photo_id }),
      // @ts-expect-error
      ...(body.sense_id && { sense_id: body.sense_id }),
      // @ts-expect-error
      ...(body.sentence_id && { sentence_id: body.sentence_id }),
      // @ts-expect-error
      ...(body.speaker_id && { speaker_id: body.speaker_id }),
      // @ts-expect-error
      ...(body.text_id && { text_id: body.text_id }),
      // @ts-expect-error
      ...(body.video_id && { video_id: body.video_id }),
      // This is the properly typed version but much more verbose as requires one for each change type
      // ...(type === 'upsert_sense' && { sense_id: body.sense_id, entry_id: body.entry_id }),
    })
      .select()
      .single()

    if (error)
      throw new Error(error.message)

    return json(content_update satisfies ContentUpdateResponseBody)
  } catch (err) {
    console.error(`Error saving change: ${err.message}`)
    kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error saving change: ${err.message}`)
  }
}
