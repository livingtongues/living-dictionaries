import type { PageLoad } from './$types'
import { api_dictionaries_catalog } from '$api/dictionaries/[id]/catalog/_call'
import { api_dictionaries_partners } from '$api/dictionaries/[id]/partners/_call'
import { api_dictionaries_id_roles_role_id_delete } from '$api/dictionaries/[id]/roles/[role_id]/_call'
import { api_dictionaries_id_invite_cancel } from '$api/dictionaries/[id]/invites/[invite_id]/_call'
import { upload_media } from '$lib/media/upload-media'
import { invalidate } from '$app/navigation'
import { inviteHelper } from '$lib/invite/invite'

export const load = (async ({ parent, data }) => {
  const { t, dictionary } = await parent()
  const { id: dictionary_id } = dictionary

  async function reload_after_operation(operation: () => Promise<any>) {
    try {
      await operation()
      await invalidate('contributors:reload')
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  async function save_catalog(fields: Record<string, unknown>) {
    const { error } = await api_dictionaries_catalog(dictionary_id, fields)
    if (error)
      throw new Error(error.message)
  }

  const editor_edits = {
    inviteHelper: (role: 'manager' | 'contributor') => {
      return async function () {
        await reload_after_operation(() => inviteHelper(role, dictionary_id))
      }
    },
    removeContributor: (role_id: string) => {
      return async function () {
        if (!confirm(`${t('misc.delete')}?`)) return
        await reload_after_operation(async () => {
          const { error } = await api_dictionaries_id_roles_role_id_delete({ dict_id: dictionary_id, role_id })
          if (error) throw new Error(error.message)
        })
      }
    },
    writeInCollaborator: async (current_collaborators: string[]) => {
      const name = prompt(`${t('speakers.name')}?`)
      if (!name) return
      await reload_after_operation(() => save_catalog({ write_in_collaborators: [...current_collaborators, name] }))
    },
    removeWriteInCollaborator: (current_collaborators: string[], name: string) => {
      return async function () {
        if (!confirm(`${t('misc.delete')}?`)) return
        await reload_after_operation(() => save_catalog({ write_in_collaborators: current_collaborators.filter(n => n !== name) }))
      }
    },
    cancelInvite: (invite_id: string) => {
      return async function () {
        if (!confirm(`${t('misc.cancel')}?`)) return
        await reload_after_operation(async () => {
          const { error } = await api_dictionaries_id_invite_cancel({ dict_id: dictionary_id, invite_id })
          if (error) throw new Error(error.message)
        })
      }
    },
  }

  const partner_edits = {
    add_partner_name: async (name: string) => {
      await reload_after_operation(async () => {
        const { error } = await api_dictionaries_partners(dictionary_id, { action: 'add', name })
        if (error) throw new Error(error.message)
      })
    },

    delete_partner: async (partner_id: string) => {
      await reload_after_operation(async () => {
        const { error } = await api_dictionaries_partners(dictionary_id, { action: 'delete', partner_id })
        if (error) throw new Error(error.message)
      })
    },

    add_partner_image: (partner_id: string, file: File) => {
      // Not a photos row — a fresh uuid keys the R2 object (`{dict}/photo/{uuid}.{ext}`).
      const handle = upload_media({ file, dictionary_id, kind: 'image', media_id: crypto.randomUUID() })
      const done = handle.done.then(async ({ storage_path }) => {
        const { error } = await api_dictionaries_partners(dictionary_id, {
          action: 'set_photo',
          partner_id,
          photo_storage_path: storage_path,
        })
        if (error)
          throw new Error(error.message)
        await invalidate('contributors:reload')
        return { storage_path }
      })
      done.catch(() => undefined) // error renders in the upload tile
      return { ...handle, done }
    },

    delete_partner_image: async ({ partner_id }: { partner_id: string, photo_id: string }) => {
      await reload_after_operation(async () => {
        const { error } = await api_dictionaries_partners(dictionary_id, { action: 'remove_photo', partner_id })
        if (error) throw new Error(error.message)
      })
    },

    hide_living_tongues_logo: async (hide: boolean) => {
      await reload_after_operation(() => save_catalog({ hide_living_tongues_logo: hide ? 1 : 0 }))
    },
  }

  async function update_citation(citation: string) {
    await reload_after_operation(() => save_catalog({ citation }))
  }

  return {
    ...data,
    editor_edits,
    partner_edits,
    update_citation,
  }
}) satisfies PageLoad
