<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { Button } from 'svelte-pieces'

  export let invite: Tables<'invites'>
  export let admin = false
  export let on_delete_invite: () => Promise<void>
</script>

<div title="Sent by {invite.inviter_email}">
  <slot name="prefix"><i>Invited: </i></slot>

  <span class="text-sm leading-5 font-medium text-gray-900">
    {invite.target_email}
  </span>
  {#if admin}
    <Button
      color="red"
      size="sm"
      onclick={on_delete_invite}>
      <span class="i-fa-solid-times" />
      <span class="i-fa-key" />
    </Button>
  {/if}
</div>
