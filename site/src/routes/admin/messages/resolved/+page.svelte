<script lang="ts">
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import MessagesTable from '$lib/admin/MessagesTable.svelte'

  let { data } = $props()
  const db = $derived(data.db)
  const current_user_id = $derived(data.auth_user.user?.id)

  const resolved = $derived(
    db?.message_threads.query({
      where: 'resolved_at IS NOT NULL',
      order_by: 'resolved_at DESC',
      limit: 9999,
    }),
  )
  const resolved_rows = $derived(resolved?.rows ?? [])
  const loading = $derived(resolved?.loading ?? true)
</script>

<MessagesTable
  {db}
  threads={resolved_rows}
  {loading}
  {current_user_id}
  show_resolved_at
  on_assigned={async () => { await data.sync?.sync() }}>
  {#snippet header_trailing()}
    <a href="/admin/messages" class="header-trail-link">
      <IconMdiArrowLeft />
      Unresolved
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
