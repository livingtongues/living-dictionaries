import { addOnline, deleteDocumentOnline, getCollection, updateOnline } from 'sveltefirets'
import type { Citation, IDictionary, IHelper, IInvite, Partner } from '@living-dictionaries/types'
import { where } from 'firebase/firestore'
import type { PageLoad } from './$types'
import { upload_image } from '$lib/components/image/upload-image'
import { invalidate } from '$app/navigation'
import { inviteHelper } from '$lib/helpers/inviteHelper'

const CONTRIBUTORS_UPDATED_LOAD_TRIGGER = 'contributors:updated'

export const load = (async ({ params: { dictionaryId }, parent, depends }) => {
  const { t, load_citation, load_partners } = await parent()
  depends(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)

  async function performDbOperation(operation: () => Promise<any>) {
    try {
      await operation()
      await invalidate(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  const editor_edits = {
    inviteHelper: (role: 'manager' | 'contributor', dictionary: IDictionary) => {
      return async function () {
        await performDbOperation(() => inviteHelper(role, dictionary))
      }
    },
    removeContributor: (id: string) => {
      return async function () {
        if (!confirm(`${t('misc.delete')}?`)) return
        await performDbOperation(() => deleteDocumentOnline(`dictionaries/${dictionaryId}/contributors/${id}`))
      }
    },
    writeInCollaborator: async () => {
      const name = prompt(`${t('speakers.name')}?`)
      if (!name) return
      await performDbOperation(() => addOnline(`dictionaries/${dictionaryId}/writeInCollaborators`, { name }))
    },
    removeWriteInCollaborator: (id: string) => {
      return async function () {
        if (!confirm(`${t('misc.delete')}?`)) return
        await performDbOperation(() => deleteDocumentOnline(`dictionaries/${dictionaryId}/writeInCollaborators/${id}`))
      }
    },
    cancelInvite: (id: string) => {
      return async function () {
        if (!confirm(`${t('misc.cancel')}?`)) return
        await performDbOperation(() => updateOnline<IInvite>(`dictionaries/${dictionaryId}/invites/${id}`, { status: 'cancelled' }))
      }
    },
  }

  const partner_edits = {
    add_partner_name: async (name: string) => {
      await performDbOperation(() => addOnline<Partner>(`dictionaries/${dictionaryId}/partners`, { name }))
    },

    delete_partner: async (partner_id: string) => {
      await performDbOperation(() => deleteDocumentOnline(`dictionaries/${dictionaryId}/partners/${partner_id}`))
    },

    add_partner_image: (partner_id: string, file: File) => {
      const status = upload_image({ file, folder: `${dictionaryId}/partners/${partner_id}/logo` })
      status.subscribe(async ({ storage_path, serving_url }) => {
        if (storage_path && serving_url) {
          await performDbOperation(() => updateOnline<Partner>(`dictionaries/${dictionaryId}/partners/${partner_id}`, { logo: {
            fb_storage_path: storage_path,
            specifiable_image_url: serving_url,
          } }))
        }
      })
      return status
    },

    delete_partner_image: async ({ partner_id }: { partner_id: string, fb_storage_path: string }) => {
      await performDbOperation(() => updateOnline<Partner>(`dictionaries/${dictionaryId}/partners/${partner_id}`, { logo: null }))
      // Presently we are not removing images from GCP storage, this could be done in a future where Supabase supports GCP as role-level security roles for storage is easy in Supabase
      // const storage = getStorage();
      // const imageRef = ref(storage, fb_storage_path);
      // await deleteObject(imageRef)
    },

    hide_living_tongues_logo: async (hide: boolean) => {
      await performDbOperation(() => updateOnline<IDictionary>(`dictionaries/${dictionaryId}`, { hideLivingTonguesLogo: hide }))
    },
  }

  async function update_citation(citation: string) {
    await performDbOperation(() => updateOnline<Citation>(`dictionaries/${dictionaryId}/info/citation`, { citation }))
  }

  return {
    editor_edits,
    partner_edits,
    managers_promise: getCollection<IHelper>(`dictionaries/${dictionaryId}/managers`),
    contributors_promise: getCollection<IHelper>(`dictionaries/${dictionaryId}/contributors`),
    invites_promise: getCollection<IInvite>(`dictionaries/${dictionaryId}/invites`, [where('status', 'in', ['queued', 'sent'])]),
    writeInCollaborators_promise: getCollection<IHelper>(`dictionaries/${dictionaryId}/writeInCollaborators`),
    update_citation,
    partners_promise: load_partners(),
    citation_promise: load_citation(),
  }
}) satisfies PageLoad
