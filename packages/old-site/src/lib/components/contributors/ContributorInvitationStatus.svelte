<script lang="ts">
  import { db_date_to_friendly } from '$lib/helpers/time'
  import { Button } from '$lib/svelte-pieces'

  interface Props {
    invite: {
      inviter_email: string
      target_email: string
      created_at: string | Date
    }
    admin?: boolean
    on_delete_invite: () => Promise<void>
    prefix?: import('svelte').Snippet
  }

  let {
    invite,
    admin = false,
    on_delete_invite,
    prefix,
  }: Props = $props()
</script>

<div title="Sent by {invite.inviter_email} on {db_date_to_friendly(invite.created_at)}">
  {#if prefix}{@render prefix()}{:else}<i>Invited: </i>{/if}

  <span class="text-sm leading-5 font-medium text-gray-900">
    {invite.target_email}
  </span>
  {#if admin}
    <Button
      color="red"
      size="sm"
      onclick={on_delete_invite}>
      <span class="i-fa-solid-times"></span>
      <span class="i-fa-key"></span>
    </Button>
  {/if}
</div>
