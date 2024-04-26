import { getCollection, updateOnline } from 'sveltefirets'
import type { IDictionary } from '@living-dictionaries/types'
import { arrayRemove, arrayUnion } from 'firebase/firestore/lite'
import { get } from 'svelte/store'
import { limit, where } from 'firebase/firestore'
import type { PageLoad } from './$types'
import { invalidateAll } from '$app/navigation'
import { upload_image } from '$lib/components/image/upload-image'

export const load: PageLoad = async ({ params: { dictionaryId }, parent }) => {
  const { t, admin, user } = await parent()

  async function updateDictionary(change: Partial<IDictionary>) {
    try {
      await updateOnline<IDictionary>(`dictionaries/${dictionaryId}`, change)
      await invalidateAll()
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  async function add_gloss_language(languageId: string) {
    await updateDictionary({ glossLanguages: arrayUnion(languageId) as unknown as string[] })
  }

  async function remove_gloss_language(languageId: string) {
    const $admin = get(admin)
    try {
      const entriesUsingGlossLanguage = await getCollection(
        `dictionaries/${dictionaryId}/words`,
        [where(`gl.${languageId}`, '>', ''), limit(1)],
      )
      if (entriesUsingGlossLanguage.length === 0) {
        await updateDictionary({ glossLanguages: arrayRemove(languageId) as unknown as string[] })
      } else if ($admin) {
        const removeGlossLanguageInUse = confirm('Remove as admin even though this glossing language is in use already? Know that regular editors get a message saying "Contact Us"')
        if (removeGlossLanguageInUse)
          await updateDictionary({ glossLanguages: arrayRemove(languageId) as unknown as string[] })
      } else {
        alert(t('header.contact_us'))
      }
    } catch (err) {
      return console.error(err)
    }
  }

  function add_featured_image(file: File) {
    const $user = get(user)
    const status = upload_image({ file, folder: `${dictionaryId}/featured_images` })
    const unsubscribe = status.subscribe(async ({ storage_path, serving_url }) => {
      if (storage_path && serving_url) {
        await updateDictionary({ featuredImage: {
          fb_storage_path: storage_path,
          specifiable_image_url: serving_url,
          uid_added_by: $user.uid,
          timestamp: new Date(),
        } })
        unsubscribe()
      }
    })
    return status
  }

  return { updateDictionary, add_gloss_language, remove_gloss_language, add_featured_image }
}
