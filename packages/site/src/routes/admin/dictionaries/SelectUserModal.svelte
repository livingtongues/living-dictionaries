<script lang="ts">
  import { Button, Modal } from 'svelte-pieces'
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'
  import Filter from '$lib/components/Filter.svelte'

  export let on_close: () => void
  export let add_editor: (user_id: string) => Promise<void>
  export let invite_editor: () => Promise<void>
  export let users: UserWithDictionaryRoles[] = []
</script>

<Modal on:close={on_close}>
  <span slot="heading"> Select a user to add role to</span>
  <Filter items={users} let:filteredItems={filteredUsers} placeholder="Search names and emails">
    {#each filteredUsers as user}
      <Button
        onclick={async () => {
          await add_editor(user.id)
          on_close()
        }}
        color="green"
        form="simple"
        class="w-full !text-left">{user.email}
        {#if user.full_name}
          <small>({user.full_name})</small>
        {/if}
      </Button>
    {:else}
      <Button
        size="sm"
        onclick={invite_editor}>Invite New User</Button>
    {/each}

    <div class="modal-footer space-x-1">
      <Button onclick={on_close} color="black">Cancel</Button>
    </div>
  </Filter>
</Modal>
