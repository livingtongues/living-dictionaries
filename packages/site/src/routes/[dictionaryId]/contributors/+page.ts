import type { PageLoad } from './$types';
import { addOnline, updateOnline, deleteDocumentOnline, collectionStore } from 'sveltefirets';
import type { Partner } from '@living-dictionaries/types';
import { upload_image } from '$lib/components/image/upload-image';

export const load = (async ({params: { dictionaryId }, parent}) => {
  const { t } = await parent();

  const partner_edits = {
    add_partner_name: async (name: string) => {
      try {
        await addOnline<Partner>(`dictionaries/${dictionaryId}/partners`, { name })
      }
      catch (err) {
        alert(`${t('misc.error')}: ${err}`);
      }
    },

    delete_partner: async (partner_id: string) => {
      try {
        await deleteDocumentOnline(`dictionaries/${dictionaryId}/partners/${partner_id}`)
      }
      catch (err) {
        alert(`${t('misc.error')}: ${err}`);
      }
    },

    add_partner_image: (partner_id: string, file: File) => {
      const status = upload_image({file, folder: `${dictionaryId}/partners/${partner_id}/logo`})
      status.subscribe(async ({storage_path, serving_url}) => {
        if (storage_path && serving_url) {
          try {
            await updateOnline<Partner>(`dictionaries/${dictionaryId}/partners/${partner_id}`, { logo: {
              fb_storage_path: storage_path,
              specifiable_image_url: serving_url,
            } })
          }
          catch (err) {
            alert(`${t('misc.error')}: ${err}`);
          }
        }
      })
      return status
    },

    delete_partner_image: async ({partner_id}: { partner_id: string, fb_storage_path: string }) => {
      try {
        await updateOnline<Partner>(`dictionaries/${dictionaryId}/partners/${partner_id}`, { logo: null })
        // Presently we are not removing images from GCP storage, this could be done in a future where Supabase supports GCP as role-level security roles for storage is easy in Supabase
        // const storage = getStorage();
        // const imageRef = ref(storage, fb_storage_path);
        // await deleteObject(imageRef)
      } catch (err) {
        alert(`${t('misc.error')}: ${err}`);
      }
    },

    allow_living_tongues_logo: async (allow_living_tongues_logo: boolean) => {
      try {
        await updateOnline(`dictionaries/${dictionaryId}`, {allowLivingTonguesLogo: allow_living_tongues_logo})
      } catch (err) {
        alert(`${t('misc.error')}: ${err}`);
      }
    },
  }

  return {
    partners: collectionStore<Partner>(`dictionaries/${dictionaryId}/partners`, [], {startWith: []}),
    partner_edits,
  };
}) satisfies PageLoad;


