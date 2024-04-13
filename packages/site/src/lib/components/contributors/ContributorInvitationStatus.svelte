<script lang="ts">
  import { Button } from 'svelte-pieces'
  import type { IInvite } from '@living-dictionaries/types'

  export let invite: Partial<IInvite>
  export let admin = false
  export let on_delete_invite: () => Promise<void>
</script>

<div title="Sent by {invite.inviterEmail}">
  <slot name="prefix"><i>Invited: </i></slot>

  <span class="text-sm leading-5 font-medium text-gray-900">
    {invite.targetEmail}
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
