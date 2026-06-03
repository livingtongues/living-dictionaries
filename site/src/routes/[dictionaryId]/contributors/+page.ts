import type { PageLoad } from './$types'
import { upload_image } from '$lib/components/image/upload-image'
import { invalidate } from '$app/navigation'
import { inviteHelper } from '$lib/helpers/inviteHelper'

const CONTRIBUTORS_UPDATED_LOAD_TRIGGER = 'contributors:updated'

export const load = (async ({ parent, depends }) => {
  const { t, load_partners, supabase, update_dictionary, dictionary } = await parent()
  const { id: dictionary_id } = dictionary
  depends(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)

  async function reload_after_operation(operation: () => Promise<any>) {
    try {
      await operation()
      await invalidate(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  const editor_edits = {
    inviteHelper: (role: 'manager' | 'contributor') => {
      return async function () {
        await reload_after_operation(() => inviteHelper(role, dictionary_id))
      }
    },
    removeContributor: (user_id: string) => {
      return async function () {
        if (!confirm(`${t('misc.delete')}?`)) return
        await reload_after_operation(async () => {
          const { error } = await supabase.from('dictionary_roles')
            .delete()
            .eq('dictionary_id', dictionary_id)
            .eq('user_id', user_id)
          if (error) throw new Error(error.message)
        })
      }
    },
    writeInCollaborator: async (current_collaborators: string[]) => {
      const name = prompt(`${t('speakers.name')}?`)
      if (!name) return
      await reload_after_operation(async () => {
        const { error } = await supabase
          .from('dictionary_info')
          .upsert([
            { id: dictionary_id, write_in_collaborators: [...current_collaborators, name] },
          ], { onConflict: 'id' })
        if (error) throw new Error(error.message)
      })
    },
    removeWriteInCollaborator: (current_collaborators: string[], name: string) => {
      return async function () {
        if (!confirm(`${t('misc.delete')}?`)) return
        await reload_after_operation(async () => {
          const { error } = await supabase
            .from('dictionary_info')
            .upsert([
              { id: dictionary_id, write_in_collaborators: current_collaborators.filter(n => n !== name) },
            ], { onConflict: 'id' })
          if (error) throw new Error(error.message)
        })
      }
    },
    cancelInvite: (invite_id: string) => {
      return async function () {
        if (!confirm(`${t('misc.cancel')}?`)) return
        await reload_after_operation(async () => {
          const { error } = await supabase.from('invites').update({ status: 'cancelled' }).eq('id', invite_id)
          if (error) throw new Error(error.message)
        })
      }
    },
  }

  const partner_edits = {
    add_partner_name: async (name: string) => {
      await reload_after_operation(async () => {
        const { error } = await supabase.from('dictionary_partners')
          .insert({ dictionary_id, name })
        if (error) throw new Error(error.message)
      })
    },

    delete_partner: async (partner_id: string) => {
      await reload_after_operation(async () => {
        const { error } = await supabase.from('dictionary_partners')
          .delete()
          .eq('id', partner_id)
        if (error) {
          console.error(error)
        }
      })
    },

    add_partner_image: (partner_id: string, file: File) => {
      const status = upload_image({ file, folder: `${dictionary_id}/partners/${partner_id}/logo` })
      status.subscribe(async ({ storage_path, serving_url }) => {
        if (storage_path && serving_url) {
          const { data, error: photo_saving_error } = await supabase.from('photos')
            .insert({ dictionary_id, storage_path, serving_url }).select('id').single()
          if (photo_saving_error) throw new Error(photo_saving_error.message)

          const { error } = await supabase.from('dictionary_partners')
            .update({ photo_id: data.id })
            .eq('id', partner_id)
          if (error) {
            console.error(error)
            alert(`${t('misc.error')}: ${error.message}`)
          }
          location.reload()
        }
      })
      return status
    },

    delete_partner_image: async ({ partner_id, photo_id }: { partner_id: string, photo_id: string }) => {
      await reload_after_operation(async () => {
        const { error } = await supabase.from('dictionary_partners')
          .update({ photo_id: null })
          .eq('id', partner_id)
        if (error) throw new Error(error.message)
        const { error: delete_error } = await supabase.from('photos')
          .update({ deleted: new Date().toISOString() })
          .eq('id', photo_id)
        if (delete_error) throw delete_error.message
      })
    },

    hide_living_tongues_logo: async (hide: boolean) => {
      try {
        await update_dictionary({ hide_living_tongues_logo: hide })
      } catch (err) {
        alert(`${t('misc.error')}: ${err}`)
      }
    },
  }

  async function update_citation(citation: string) {
    await reload_after_operation(async () => {
      const { error } = await supabase
        .from('dictionary_info')
        .upsert([
          { id: dictionary_id, citation },
        ], { onConflict: 'id' })
      if (error) throw new Error(error.message)
    })
  }

  async function get_invites() {
    const { data: invites, error } = await supabase.from('invites')
      .select()
      .eq('dictionary_id', dictionary_id)
      .in('status', ['queued', 'sent'])
    if (error) throw new Error(error.message)
    return invites
  }

  return {
    editor_edits,
    partner_edits,
    update_citation,
    invites_promise: get_invites(),
    partners_promise: load_partners(),
  }
}) satisfies PageLoad
