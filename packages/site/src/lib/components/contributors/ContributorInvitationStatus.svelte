<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { supabase_date_to_friendly } from '$lib/helpers/time'
  import { Button } from '$lib/svelte-pieces'

  interface Props {
    invite: Tables<'invites'>
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

<div title="Sent by {invite.inviter_email} on {supabase_date_to_friendly(invite.created_at)}">
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
