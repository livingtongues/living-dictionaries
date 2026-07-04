import type { PageLoad } from './$types'
import { goto } from '$app/navigation'
import { pruneObject } from '$lib/utils/prune'
import { api_dictionaries_create } from '$api/dictionaries/create/_call'
import type { DictionariesCreateRequestBody } from '$api/dictionaries/create/+server'
import { api_dictionaries_id_exists } from '$api/dictionaries/[id]/_call'

const mode = import.meta.env.MODE as 'development' | 'production'

export const load = (({ parent }) => {
  const MIN_URL_LENGTH = 3

  function dictionary_id_exists(url: string): Promise<boolean> {
    return api_dictionaries_id_exists(url)
  }

  async function create_dictionary(dictionary: DictionariesCreateRequestBody) {
    const { t, ssr_user, dict_roles } = await parent()
    if (!ssr_user) return alert('Please login first') // this should never fire as should be caught in page

    if (dictionary.id.length < MIN_URL_LENGTH) {
      return alert(t('create.choose_different_url'))
    }

    try {
      const pruned_dictionary = pruneObject(dictionary) as DictionariesCreateRequestBody
      if (mode === 'development') {
        console.info(pruned_dictionary)
        if (!confirm('Dictionary value logged to console because in dev mode. Do you still want to create this dictionary?')) {
          return
        }
      }

      const { data, error } = await api_dictionaries_create(pruned_dictionary)
      if (error || !data)
        throw new Error(error?.message || 'Could not create dictionary')

      // The creating user is now this dictionary's manager. A warm dict_roles
      // cache won't include the fresh grant (refresh_if_stale skips a <1h-old
      // cache), so refresh it BEFORE navigating — otherwise the [dictionaryId]
      // layout computes can_edit=false and opens the dict pull-only (the new
      // manager couldn't add entries until a later refresh).
      await dict_roles.refresh()

      // Soft client-side navigation (was window.location.replace) keeps the
      // local-first runtime alive — the per-dict leader worker, sync engine, and
      // continuous log session — instead of a full page reboot. The brand-new
      // dict has no R2 snapshot yet; dict-instance boot treats that as non-fatal
      // (empty OPFS DB, sync backfills) and the server dictionaries/<id>.db is
      // created on demand on the first editor snapshot/changes request.
      // invalidateAll re-runs the layout loads so the new catalog row + role take
      // effect; replaceState so Back doesn't return to this form.
      await goto(`/${data.id}/entries`, { invalidateAll: true, replaceState: true })
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }
  return {
    MIN_URL_LENGTH,
    dictionary_id_exists,
    create_dictionary,
  }
}) satisfies PageLoad
