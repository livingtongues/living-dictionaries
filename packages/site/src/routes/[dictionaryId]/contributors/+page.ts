import { addOnline, deleteDocumentOnline, getCollection, updateOnline } from 'sveltefirets'
import type { Citation, IDictionary, IHelper, Partner } from '@living-dictionaries/types'
import type { PageLoad } from './$types'
import { upload_image } from '$lib/components/image/upload-image'
import { invalidate } from '$app/navigation'

const CONTRIBUTORS_UPDATED_LOAD_TRIGGER = 'contributors:updated'

export const load = (async ({ params: { dictionaryId }, parent, depends }) => {
  const { t, load_citation, load_partners } = await parent()
  depends(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)

  const editor_edits = {
    writeIn: async () => {
      const name = prompt(`${t('speakers.name')}?`)
      if (name) {
        await addOnline(`dictionaries/${dictionaryId}/writeInCollaborators`, { name })
        await invalidate(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)
      }
    },
  }

  const partner_edits = {
    add_partner_name: async (name: string) => {
      try {
        await addOnline<Partner>(`dictionaries/${dictionaryId}/partners`, { name })
        await invalidate(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)
      } catch (err) {
        alert(`${t('misc.error')}: ${err}`)
      }
    },

    delete_partner: async (partner_id: string) => {
      try {
        await deleteDocumentOnline(`dictionaries/${dictionaryId}/partners/${partner_id}`)
        await invalidate(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)
      } catch (err) {
        alert(`${t('misc.error')}: ${err}`)
      }
    },

    add_partner_image: (partner_id: string, file: File) => {
      const status = upload_image({ file, folder: `${dictionaryId}/partners/${partner_id}/logo` })
      status.subscribe(async ({ storage_path, serving_url }) => {
        if (storage_path && serving_url) {
          try {
            await updateOnline<Partner>(`dictionaries/${dictionaryId}/partners/${partner_id}`, { logo: {
              fb_storage_path: storage_path,
              specifiable_image_url: serving_url,
            } })
            await invalidate(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)
          } catch (err) {
            alert(`${t('misc.error')}: ${err}`)
          }
        }
      })
      return status
    },

    delete_partner_image: async ({ partner_id }: { partner_id: string, fb_storage_path: string }) => {
      try {
        await updateOnline<Partner>(`dictionaries/${dictionaryId}/partners/${partner_id}`, { logo: null })
        // Presently we are not removing images from GCP storage, this could be done in a future where Supabase supports GCP as role-level security roles for storage is easy in Supabase
        // const storage = getStorage();
        // const imageRef = ref(storage, fb_storage_path);
        // await deleteObject(imageRef)
        await invalidate(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)
      } catch (err) {
        alert(`${t('misc.error')}: ${err}`)
      }
    },

    hide_living_tongues_logo: async (hide: boolean) => {
      try {
        await updateOnline<IDictionary>(`dictionaries/${dictionaryId}`, { hideLivingTonguesLogo: hide })
        await invalidate(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)
      } catch (err) {
        alert(`${t('misc.error')}: ${err}`)
      }
    },
  }

  async function update_citation(citation: string) {
    try {
      await updateOnline<Citation>(`dictionaries/${dictionaryId}/info/citation`, { citation })
      await invalidate(CONTRIBUTORS_UPDATED_LOAD_TRIGGER)
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  return {
    editor_edits,
    partner_edits,
    writeInCollaborators_promise: getCollection<IHelper>(`dictionaries/${dictionaryId}/writeInCollaborators`),
    update_citation,
    partners_promise: load_partners(),
    citation_promise: load_citation(),
  }
}) satisfies PageLoad
