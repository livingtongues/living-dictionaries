import { randomUUID } from 'node:crypto'
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
    const { update_id, import_meta, auth_token, dictionary_id, import_id, type, data } = body

    const admin_supabase = getAdminSupabaseClient()

    let user_id: string

    if (dev)
      // @ts-expect-error
      user_id = import_meta?.user_id || data?.updated_by || data?.created_by

    if (auth_token) {
      const decoded_token = await decodeToken(auth_token)
      if (!decoded_token?.uid)
        throw new Error('No user id found in token')

      await checkForPermission(decoded_token.uid, dictionary_id)

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

    const timestamp = dev
    // @ts-expect-error
      ? import_meta?.timestamp || data?.updated_at || data?.created_at || new Date().toISOString()
      : new Date().toISOString()

    const c_u_meta = {
      created_by: user_id,
      updated_by: user_id,
      created_at: timestamp,
      updated_at: timestamp,
    }

    const c_meta = {
      created_by: user_id,
      created_at: timestamp,
    }

    const u_meta = {
      updated_by: user_id,
      updated_at: timestamp,
    }

    if (data?.deleted) {
      data.deleted = timestamp
    }

    const { data: dictionary } = await admin_supabase.from('dictionaries').select().eq('id', dictionary_id).single()
    if (!dictionary) {
      const { error } = await admin_supabase.from('dictionaries').insert({
        ...c_u_meta,
        id: dictionary_id,
        name: 'CHANGE',
      })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'insert_entry') {
      const { error } = await admin_supabase.from('entries').insert({
        ...c_u_meta,
        ...data,
        dictionary_id,
        id: body.entry_id,
      })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }

      if (!import_id) {
        const { data: sense_data, error: sense_error } = await admin_supabase.from('senses')
          .insert({
            ...c_u_meta,
            id: randomUUID(),
            entry_id: body.entry_id,
          })
        if (sense_error) {
          console.info({ body })
          throw new Error(sense_error.message)
        }
        // @ts-expect-error
        body.sense_id = sense_data?.id
      }
    }

    if (type === 'update_entry') {
      const { error } = await admin_supabase.from('entries').update({
        ...u_meta,
        ...data,
      }).eq('id', body.entry_id)
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'insert_sense') {
      const { error } = await admin_supabase.from('senses')
        .insert({
          ...c_u_meta,
          ...data,
          id: body.sense_id || randomUUID(),
          entry_id: body.entry_id,
        })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'update_sense') {
      const { error } = await admin_supabase.from('senses').update({
        ...u_meta,
        ...data,
      }).eq('id', body.sense_id)
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'insert_tag') {
      const { error } = await admin_supabase.from('tags')
        .insert({
          ...c_u_meta,
          ...data,
          dictionary_id,
          id: body.tag_id,
        })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'assign_tag') {
      const { error } = await admin_supabase.from('entry_tags')
        .upsert({
          ...c_meta,
          tag_id: body.tag_id,
          entry_id: body.entry_id,
          deleted: data?.deleted ? timestamp : null,
        })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'insert_dialect') {
      const { error } = await admin_supabase.from('dialects')
        .insert({
          ...c_u_meta,
          ...data,
          dictionary_id,
          id: body.dialect_id,
        })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'assign_dialect') {
      const { error } = await admin_supabase.from('entry_dialects')
        .upsert({
          ...c_meta,
          dialect_id: body.dialect_id,
          entry_id: body.entry_id,
          deleted: data?.deleted ? timestamp : null,
        })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'upsert_speaker') {
      const { error } = await admin_supabase.from('speakers')
        .upsert({
          ...c_u_meta,
          ...data,
          dictionary_id,
          id: body.speaker_id,
        } as TablesInsert<'speakers'>)
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'assign_speaker' && body.audio_id) {
      const { error } = await admin_supabase.from('audio_speakers')
        .upsert({
          ...c_meta,
          speaker_id: body.speaker_id,
          audio_id: body.audio_id,
          deleted: data?.deleted ? timestamp : null,
        })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'assign_speaker' && body.video_id) {
      const { error } = await admin_supabase.from('video_speakers')
        .upsert({
          ...c_meta,
          speaker_id: body.speaker_id,
          video_id: body.video_id,
          deleted: data?.deleted ? timestamp : null,
        })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'insert_sentence') {
      const { error } = await admin_supabase.from('sentences')
        .insert({
          ...c_u_meta,
          ...data,
          dictionary_id,
          id: body.sentence_id,
        })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }

      const { error: connect_error } = await admin_supabase.from('senses_in_sentences')
        .insert({
          ...c_meta,
          sentence_id: body.sentence_id,
          sense_id: body.sense_id,
        })
      if (connect_error) {
        console.info({ body })
        throw new Error(connect_error.message)
      }
    }

    if (type === 'update_sentence') {
      const { error } = await admin_supabase.from('sentences')
        .update({
          ...u_meta,
          ...data,
        })
        .eq('id', body.sentence_id)
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'upsert_audio') {
      if (body.entry_id) {
        const { error } = await admin_supabase.from('audio').upsert({
          ...c_u_meta,
          ...data,
          dictionary_id,
          id: body.audio_id,
          entry_id: body.entry_id,
        } as TablesInsert<'audio'>)
        if (error) {
          console.info({ body })
          throw new Error(error.message)
        }
      } else {
        const { error } = await admin_supabase.from('audio').update({
          ...u_meta,
          ...data,
        })
          .eq('id', body.audio_id)
        if (error) {
          console.info({ body })
          throw new Error(error.message)
        }
      }
    }

    if (type === 'insert_photo') {
      const { error } = await admin_supabase.from('photos')
        .insert({
          ...c_u_meta,
          ...data,
          dictionary_id,
          id: body.photo_id,
        })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }

      const { error: connect_error } = await admin_supabase.from('sense_photos')
        .insert({
          ...c_meta,
          photo_id: body.photo_id,
          sense_id: body.sense_id,
        })
      if (connect_error)
        throw new Error(connect_error.message)
    }

    if (type === 'update_photo') {
      const { error } = await admin_supabase.from('photos')
        .update({
          ...u_meta,
          ...data,
        })
        .eq('id', body.photo_id)
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
    }

    if (type === 'insert_video') {
      const { error } = await admin_supabase.from('videos')
        .insert({
          ...c_u_meta,
          ...data,
          dictionary_id,
          id: body.video_id,
        })
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }

      const { error: connect_error } = await admin_supabase.from('sense_videos')
        .insert({
          ...c_meta,
          video_id: body.video_id,
          sense_id: body.sense_id,
        })
      if (connect_error)
        throw new Error(connect_error.message)
    }

    if (type === 'update_video') {
      const { error } = await admin_supabase.from('videos')
        .update({
          ...u_meta,
          ...data,
        })
        .eq('id', body.video_id)
      if (error) {
        console.info({ body })
        throw new Error(error.message)
      }
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
      ...(body.tag_id && { tag_id: body.tag_id }),
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
      // ...(type === 'insert_sense' && { sense_id: body.sense_id, entry_id: body.entry_id }),
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
