<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import { date_to_friendly } from '$lib/utils/time'
  import IconFaSolidTimes from '~icons/fa-solid/times'
  import IconFaKey from '~icons/fa/key'

  interface Props {
    invite: { id: string, inviter_email: string, target_email: string, role: string, status: string, created_at: string }
    admin?: boolean
    on_delete_invite: () => Promise<void>
    prefix?: import('svelte').Snippet
  }

  const {
    invite,
    admin = false,
    on_delete_invite,
    prefix,
  }: Props = $props()
</script>

<div title="Sent by {invite.inviter_email} on {date_to_friendly(invite.created_at)}">
  {#if prefix}{@render prefix()}{:else}<i>Invited: </i>{/if}

  <span class="invite-email">
    {invite.target_email}
  </span>
  {#if admin}
    <HeadlessButton style="color: var(--danger)" class="btn btn-sm" onclick={on_delete_invite}>
      <IconFaSolidTimes />
      <IconFaKey />
    </HeadlessButton>
  {/if}
</div>

<style>
  .invite-email {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: var(--color); /* ≈ gray-900 */
  }
</style>
