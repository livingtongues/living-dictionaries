import type { TablesUpdate } from '@living-dictionaries/types'
import { get } from 'svelte/store'
import type { PageLoad } from './$types'
import { upload_image } from '$lib/components/image/upload-image'

export const load: PageLoad = async ({ params: { dictionaryId }, parent }) => {
  const { t, admin, user, dictionary, update_dictionary } = await parent()

  async function updateDictionary(change: TablesUpdate<'dictionaries'>) {
    try {
      await update_dictionary(change)
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  async function remove_gloss_language(languageId: string) {
    const $admin = get(admin)
    try {
      if ($admin) {
        const remove_language = confirm('Remove as admin even though this glossing language may be in use already? Know that regular editors get a message saying "Contact Us"')
        if (remove_language) {
          const gloss_languages = dictionary.gloss_languages.filter(id => id !== languageId)
          await updateDictionary({ gloss_languages })
        }
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
        await updateDictionary({ featured_image: {
          fb_storage_path: storage_path,
          specifiable_image_url: serving_url,
          uid_added_by: $user.id,
          timestamp: new Date(),
        } })
        unsubscribe()
      }
    })
    return status
  }

  return { updateDictionary, remove_gloss_language, add_featured_image }
}
