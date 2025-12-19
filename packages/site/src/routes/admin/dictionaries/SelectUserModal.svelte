<script lang="ts">
  import { Button, Modal } from '$lib/svelte-pieces'
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'
  import Filter from '$lib/components/Filter.svelte'

  interface Props {
    on_close: () => void;
    add_editor: (user_id: string) => Promise<void>;
    invite_editor: () => Promise<void>;
    users?: UserWithDictionaryRoles[];
  }

  let {
    on_close,
    add_editor,
    invite_editor,
    users = []
  }: Props = $props();
</script>

<Modal {on_close}>
  {#snippet heading()}
    <span > Select a user to add role to</span>
  {/snippet}
  <Filter items={users}  placeholder="Search names and emails">
    {#snippet children({ filteredItems: filteredUsers })}
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
          {/snippet}
    </Filter>
</Modal>
