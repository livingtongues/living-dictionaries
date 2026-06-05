<script lang="ts">
  import IconMdiArrowRight from '~icons/mdi/arrow-right'
  import MessagesTable from '$lib/admin/MessagesTable.svelte'

  let { data } = $props()
  const db = $derived(data.db)
  const current_user_id = $derived(data.auth_user.user?.id)

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
    <a href="/admin/messages/resolved" class="header-trail-link">
      Resolved
      <IconMdiArrowRight />
    </a>
  {/snippet}
</MessagesTable>

<style>
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
</style>
