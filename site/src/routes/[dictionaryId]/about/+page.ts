import { invalidateAll } from '$app/navigation'

export function load({ parent }) {
  async function update_about(updated: string) {
    const { t, supabase, dictionary } = await parent()
    try {
      const { error } = await supabase
        .from('dictionary_info')
        .upsert([
          { id: dictionary.id, about: updated },
        ], { onConflict: 'id' })
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
