import { randomUUID } from 'node:crypto'
import type { TablesInsert } from '@living-dictionaries/types'
import type { IHelper, IInvite } from '@living-dictionaries/types/invite.interface'
import type { Partner } from '@living-dictionaries/types/dictionary.interface'
import { sql_file_string } from '../import/to-sql-string'
import { jacob_ld_user_id } from '../constants'
import { get_supabase_user_id_from_firebase_uid } from './get-user-id'

export function generate_inserts({
  dictionary_ids,
  fb_managers,
  fb_contributors,
  fb_partners,
  fb_invites,
  fb_writeInCollaborators,
  fb_dictionary_infos,
}: {
  dictionary_ids: string[]
  fb_managers: Record<string, IHelper[]>
  fb_contributors: Record<string, IHelper[]>
  fb_partners: Record<string, Partner[]>
  fb_invites: Record<string, IInvite[]>
  fb_writeInCollaborators: Record<string, IHelper[]>
  fb_dictionary_infos: Record<string, {
    about?: string
    grammar?: string
    citation?: string
    createdBy?: string
    updatedBy?: string
  }>
}): string {
  let sql_statements = ''

  for (const dictionary_id of dictionary_ids) {
    for (const manager of fb_managers[dictionary_id] || []) {
      // @ts-expect-error
      const seconds_created_at = manager.createdAt?._seconds

      const user_id = get_supabase_user_id_from_firebase_uid(manager.id)
      if (!user_id) {
        console.error(`trying to add manager: No Supabase user found for Firebase UID: ${manager.id}`)
        continue
      }
      const dictionary_role: TablesInsert<'dictionary_roles'> = {
        dictionary_id,
        role: 'manager',
        user_id: get_supabase_user_id_from_firebase_uid(manager.id),
        ...(seconds_created_at && { created_at: seconds_to_timestamp_string(seconds_created_at) }),
      }
      sql_statements += sql_file_string('dictionary_roles', dictionary_role)
    }

    for (const contributor of fb_contributors[dictionary_id] || []) {
      // @ts-expect-error
      const seconds_created_at = contributor.createdAt?._seconds

      const dictionary_role: TablesInsert<'dictionary_roles'> = {
        dictionary_id,
        role: 'contributor',
        user_id: get_supabase_user_id_from_firebase_uid(contributor.id),
        ...(seconds_created_at && { created_at: seconds_to_timestamp_string(seconds_created_at) }),
      }
      sql_statements += sql_file_string('dictionary_roles', dictionary_role)
    }

    for (const partner of fb_partners[dictionary_id] || []) {
      // @ts-expect-error
      const seconds_created_at = partner.createdAt?._seconds
      // @ts-expect-error
      const seconds_updated_at = partner.updatedAt?._seconds

      let photo_id: string
      if (partner.logo?.fb_storage_path) {
        photo_id = randomUUID()
        const photo: TablesInsert<'photos'> = {
          id: photo_id,
          dictionary_id,
          storage_path: partner.logo.fb_storage_path,
          serving_url: partner.logo.specifiable_image_url,
          ...(seconds_created_at && { created_at: seconds_to_timestamp_string(seconds_created_at) }),
          ...(seconds_updated_at && { updated_at: seconds_to_timestamp_string(seconds_updated_at) }),
          created_by: get_supabase_user_id_from_firebase_uid(partner.createdBy) || jacob_ld_user_id,
          updated_by: get_supabase_user_id_from_firebase_uid(partner.updatedBy) || jacob_ld_user_id,
        }
        sql_statements += sql_file_string('photos', photo)
      }

      const dictionary_partner: TablesInsert<'dictionary_partners'> = {
        dictionary_id,
        name: partner.name,
        ...(photo_id && { photo_id }),
        ...(seconds_created_at && { created_at: seconds_to_timestamp_string(seconds_created_at) }),
        ...(seconds_updated_at && { updated_at: seconds_to_timestamp_string(seconds_updated_at) }),
        created_by: get_supabase_user_id_from_firebase_uid(partner.createdBy) || jacob_ld_user_id,
        updated_by: get_supabase_user_id_from_firebase_uid(partner.updatedBy) || jacob_ld_user_id,
      }
      sql_statements += sql_file_string('dictionary_partners', dictionary_partner)
    }

    for (const invite of fb_invites[dictionary_id] || []) {
      // @ts-expect-error
      const seconds_created_at = invite.createdAt?._seconds
      const dictionary_invite: TablesInsert<'invites'> = {
        dictionary_id,
        inviter_email: invite.inviterEmail,
        target_email: invite.targetEmail,
        role: invite.role || 'contributor',
        status: invite.status,
        created_by: get_supabase_user_id_from_firebase_uid(invite.createdBy) || jacob_ld_user_id,
        ...(seconds_created_at && { created_at: seconds_to_timestamp_string(seconds_created_at) }),
      }

      sql_statements += sql_file_string('invites', dictionary_invite)
    }

    const dictionary_info_update: TablesInsert<'dictionary_info'> = {
      id: dictionary_id,
      created_by: jacob_ld_user_id,
      updated_by: jacob_ld_user_id,
    }

    if (fb_writeInCollaborators[dictionary_id]) {
      dictionary_info_update.write_in_collaborators = [...fb_writeInCollaborators[dictionary_id].map(({ name }) => name)]
      if (fb_writeInCollaborators[dictionary_id][0].createdBy) {
        dictionary_info_update.created_by = get_supabase_user_id_from_firebase_uid(fb_writeInCollaborators[dictionary_id][0].createdBy)
      }
      if (fb_writeInCollaborators[dictionary_id][0].updatedBy) {
        dictionary_info_update.updated_by = get_supabase_user_id_from_firebase_uid(fb_writeInCollaborators[dictionary_id][0].updatedBy)
      }
    }

    if (fb_dictionary_infos[dictionary_id]) {
      if (fb_dictionary_infos[dictionary_id].about)
        dictionary_info_update.about = fb_dictionary_infos[dictionary_id].about
      if (fb_dictionary_infos[dictionary_id].grammar)
        dictionary_info_update.grammar = fb_dictionary_infos[dictionary_id].grammar
      if (fb_dictionary_infos[dictionary_id].citation)
        dictionary_info_update.citation = fb_dictionary_infos[dictionary_id].citation
      if (fb_dictionary_infos[dictionary_id].createdBy)
        dictionary_info_update.created_by = get_supabase_user_id_from_firebase_uid(fb_dictionary_infos[dictionary_id].createdBy)
      if (fb_dictionary_infos[dictionary_id].updatedBy)
        dictionary_info_update.updated_by = get_supabase_user_id_from_firebase_uid(fb_dictionary_infos[dictionary_id].updatedBy)
    }

    if (Object.keys(dictionary_info_update).length > 3) {
      sql_statements += sql_file_string('dictionary_info', dictionary_info_update)
    }
  }
  return sql_statements
}

function seconds_to_timestamp_string(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}
