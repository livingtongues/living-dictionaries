<script lang="ts">
  import { Button } from 'svelte-pieces';
  import type { IInvite } from '@living-dictionaries/types';
  export let invite: Partial<IInvite>;
  export let admin: number | boolean = false;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ delete: { id: string } }>();
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
      onclick={() => {
        if (confirm('Are you sure you want to delete this invite?')) {
          dispatch('delete', { id: invite.id });
        }
      }}>
      <span class="i-fa-solid-times" />
      <span class="i-fa-key" />
    </Button>
  {/if}
</div>
