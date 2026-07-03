<script lang="ts">
  import IconMdiAccountSearch from '~icons/mdi/account-search'
  import IconMdiArrowRight from '~icons/mdi/arrow-right'
  import IconMdiEmailPlusOutline from '~icons/mdi/email-plus-outline'
  import { goto } from '$app/navigation'
  import ComposeEmailModal from '$lib/admin/messages/compose-email-modal.svelte'
  import { get_admin } from '$lib/admins'
  import { support_address } from '$lib/email/addresses'
  import MessagesTable from '$lib/admin/MessagesTable.svelte'

  let { data } = $props()
  const db = $derived(data.db)
  const current_user_id = $derived(data.auth_user.user?.id)

  const outbound_from = $derived.by(() => {
    const admin = get_admin(data.auth_user.user?.email)
    return admin
      ? { email: admin.ld_address, name: admin.name }
      : { email: support_address.email, name: support_address.name ?? 'Support' }
  })

  let compose_open = $state(false)

  async function on_compose_sent(thread_id: string) {
    compose_open = false
    await data.sync?.sync()
    await goto(`/admin/messages/${thread_id}`)
  }

  const unresolved = $derived(
    db?.message_threads.query({
      where: 'resolved_at IS NULL',
      order_by: 'last_message_at DESC',
      limit: 9999,
    }),
  )
  const unresolved_rows = $derived(unresolved?.rows ?? [])
  const loading = $derived(unresolved?.loading ?? true)
</script>

<MessagesTable
  {db}
  threads={unresolved_rows}
  {loading}
  {current_user_id}
  on_assigned={async () => { await data.sync?.sync() }}>
  {#snippet header_trailing()}
    <button type="button" class="header-trail-btn" onclick={() => { compose_open = true }}>
      Compose
      <IconMdiEmailPlusOutline />
    </button>
    <a href="/admin/messages/unmatched" class="header-trail-link">
      <IconMdiAccountSearch />
      Unmatched
    </a>
    <a href="/admin/messages/resolved" class="header-trail-link spaced">
      Resolved
      <IconMdiArrowRight />
    </a>
  {/snippet}
</MessagesTable>

{#if compose_open}
  <ComposeEmailModal
    {db}
    from_email={outbound_from.email}
    from_name={outbound_from.name}
    on_close={() => { compose_open = false }}
    on_sent={on_compose_sent} />
{/if}

<style>
  .header-trail-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-right: 1rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--primary);
    font: inherit;
    font-size: inherit;
    cursor: pointer;
    transition: color 0.15s;
  }
  .header-trail-btn:hover {
    color: var(--color);
  }
  .header-trail-link {
    color: var(--color-secondary);
    text-decoration: none;
    transition: color 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .header-trail-link:hover {
    color: var(--color);
  }
  .header-trail-link.spaced {
    margin-left: 1rem;
  }
</style>
