<script lang="ts">
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'
  import type { DictionaryView } from '@living-dictionaries/types'
  import DictionariesHelping from './DictionariesHelping.svelte'
  import type { PageData } from './$types'
  import { supabase_date_to_friendly } from '$lib/helpers/time'
  import { page } from '$app/stores'

  export let user: UserWithDictionaryRoles
  export let dictionaries: DictionaryView[]
  export let load_data: () => Promise<void>

  $: ({ admin, supabase, add_editor, remove_editor } = $page.data as PageData)
  $: managing_dictionary_ids = user.dictionary_roles.filter(({ role }) => role === 'manager').map(({ dictionary_id }) => dictionary_id) || []
  $: contributing_dictionary_ids = user.dictionary_roles.filter(({ role }) => role === 'contributor').map(({ dictionary_id }) => dictionary_id) || []
</script>

<tr title={$admin > 1 && JSON.stringify(user, null, 1)}>
  <td class="font-bold">
    {user.email}
  </td>
  <td>
    {user.full_name || ''}
  </td>
  <td>
    <DictionariesHelping
      {dictionaries}
      dictionary_ids={managing_dictionary_ids}
      remove_dictionary={async (dictionary_id) => {
        await remove_editor({ dictionary_id, user_id: user.id })
        await load_data()
      }}
      add_dictionary={async (dictionary_id) => {
        await add_editor({ dictionary_id, user_id: user.id, role: 'manager' })
        await load_data()
      }} />
  </td>
  <td>
    <DictionariesHelping
      {dictionaries}
      dictionary_ids={contributing_dictionary_ids}
      remove_dictionary={async (dictionary_id) => {
        await remove_editor({ dictionary_id, user_id: user.id })
        await load_data()
      }}
      add_dictionary={async (dictionary_id) => {
        await add_editor({ dictionary_id, user_id: user.id, role: 'contributor' })
        await load_data()
      }} />
  </td>
  <td class="whitespace-nowrap">
    {#if user.last_sign_in_at}{supabase_date_to_friendly(user.last_sign_in_at)}{/if}
  </td>
  <td class="whitespace-nowrap">
    {#if user.created_at}{supabase_date_to_friendly(user.created_at)}{/if}
  </td>
  <td>
    {#if user.unsubscribed_from_emails}
      <button
        type="button"
        title="Click to re-subscribe"
        class="hover:underline text-red-600"
        on:click={async () => {
          if (confirm('Re-subscribe user?')) {
            const { error } = await supabase.from('user_data').update({ unsubscribed_from_emails: null }).eq('id', user.id)
            if (error) {
              alert(error.message)
              console.error(error)
            } else {
              await load_data()
            }
          }
        }}>{supabase_date_to_friendly(user.unsubscribed_from_emails)}</button>
    {:else}
      <button
        type="button"
        class="text-xs hover:underline text-gray-700"
        on:click={async () => {
          const { error } = await supabase.from('user_data').update({ unsubscribed_from_emails: new Date().toISOString() }).eq('id', user.id)
          if (error) {
            alert(error.message)
            console.error(error)
          } else {
            await load_data()
          }
        }}>Mark Unsubscribed</button>
    {/if}
  </td>
</tr>
