<script lang="ts">
  import { BadgeArrayEmit, ShowHide } from 'svelte-pieces'
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'

  export let users: UserWithDictionaryRoles[] = []
  export let editors: UserWithDictionaryRoles[] = []
  export let remove_editor: (user_id: string) => Promise<void>
  export let add_editor: (user_id: string) => Promise<void>
  export let invite_editor: () => Promise<void>
</script>

<ShowHide let:show let:toggle>
  <BadgeArrayEmit
    strings={editors.map(({ full_name, email }) => full_name || email)}
    canEdit
    addMessage="Add"
    on:itemclicked={e => alert(`email: ${editors[e.detail.index].email}, id: ${editors[e.detail.index].id}`)}
    on:itemremoved={async e => await remove_editor(editors[e.detail.index].id)}
    on:additem={toggle} />

  {#if show}
    {@const users_without_editors = users.filter(({ id: user_id }) => !editors.some(({ id: editor_id }) => editor_id === user_id))}
    {#await import('./SelectUserModal.svelte') then { default: SelectUserModal }}
      <SelectUserModal users={users_without_editors} {add_editor} {invite_editor} on_close={toggle} />
    {/await}
  {/if}
</ShowHide>
