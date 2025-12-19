<script lang="ts">
  import { BadgeArrayEmit, ShowHide } from 'svelte-pieces'
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'

  interface Props {
    users?: UserWithDictionaryRoles[];
    editors?: UserWithDictionaryRoles[];
    remove_editor: (user_id: string) => Promise<void>;
    add_editor: (user_id: string) => Promise<void>;
    invite_editor: () => Promise<void>;
  }

  let {
    users = [],
    editors = [],
    remove_editor,
    add_editor,
    invite_editor
  }: Props = $props();
</script>

<ShowHide  >
  {#snippet children({ show, toggle })}
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
  {/snippet}
</ShowHide>
