import { invalidateAll } from '$app/navigation'

export function load({ params: { dictionaryId }, parent }) {
  async function update_about(updated: string) {
    const { t, supabase } = await parent()
    try {
      const { error } = await supabase
        .from('dictionary_info')
        .upsert([
          { dictionary_id: dictionaryId, about: updated },
        ], { onConflict: 'dictionary_id' })
      if (error) {
        console.error(error)
        throw error.message
      }
      await invalidateAll()
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  return { update_about }
}
