<script lang="ts">
  import type { DictionaryView } from '@living-dictionaries/types'
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'
  import type { PageData } from './$types'
  import { page } from '$app/state'
  import { supabase_date_to_friendly } from '$lib/helpers/time'
  import { Button } from '$lib/svelte-pieces'
  import DictionariesHelping from './DictionariesHelping.svelte'

  interface Props {
    user: UserWithDictionaryRoles
  }

  let { user }: Props = $props()

  let { admin, db, add_editor, remove_editor } = $derived(page.data as PageData)
  let dictionaries = $derived((db?.dictionaries.rows ?? []) as unknown as DictionaryView[])
  let managing_dictionary_ids = $derived(user.dictionary_roles.filter(({ role }) => role === 'manager').map(({ dictionary_id }) => dictionary_id) || [])
  let contributing_dictionary_ids = $derived(user.dictionary_roles.filter(({ role }) => role === 'contributor').map(({ dictionary_id }) => dictionary_id) || [])
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
      }}
      add_dictionary={async (dictionary_id) => {
        await add_editor({ dictionary_id, user_id: user.id, role: 'manager' })
      }} />
  </td>
  <td>
    <DictionariesHelping
      {dictionaries}
      dictionary_ids={contributing_dictionary_ids}
      remove_dictionary={async (dictionary_id) => {
        await remove_editor({ dictionary_id, user_id: user.id })
      }}
      add_dictionary={async (dictionary_id) => {
        await add_editor({ dictionary_id, user_id: user.id, role: 'contributor' })
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
      <Button
        title="Click to re-subscribe"
        color="red"
        form="simple"
        size="sm"
        class="-ml-2"
        onclick={async () => {
          if (confirm('Re-subscribe user?')) {
            const user_data = db?.user_data.id(user.id)
            if (user_data) {
              user_data.unsubscribed_from_emails = null
              await user_data._save()
            }
          }
        }}>{supabase_date_to_friendly(user.unsubscribed_from_emails)}</Button>
    {:else}
      <Button
        color="black"
        form="simple"
        size="sm"
        class="-ml-2"
        onclick={async () => {
          const user_data = db?.user_data.id(user.id)
          if (user_data) {
            user_data.unsubscribed_from_emails = new Date()
            await user_data._save()
          }
        }}>Mark Unsubscribed</Button>
    {/if}
  </td>
</tr>
