<script lang="ts">
  import type { AdminImportRow } from '$api/admin/imports/+server'
  import { api_admin_imports_list } from '$api/admin/imports/_call'
  import { api_conversation_brief } from '$api/v1/dictionaries/[id]/conversations/_call'
  import { ADMINS } from '$lib/admins'
  import ImportsTable from '$lib/import/admin/ImportsTable.svelte'
  import { toast } from '$lib/state/toast.svelte'
  import { onMount } from 'svelte'

  let { data } = $props()
  let imports = $state<AdminImportRow[]>([])
  let loading = $state(true)

  const admin_users_query = $derived.by(() => {
    if (!data.db) return null
    const placeholders = ADMINS.map(() => '?').join(',')
    return data.db.users.query({
      where: `email IN (${placeholders})`,
      params: ADMINS.map(admin => admin.email),
    })
  })

  const admin_user_id_by_email = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, string>()
    for (const user of admin_users_query?.rows ?? []) {
      if (user.email) map.set(user.email, user.id)
    }
    return map
  })

  async function refresh() {
    const { data, error } = await api_admin_imports_list()
    loading = false
    if (error) {
      toast.error(error.message)
      return
    }
    imports = data?.imports ?? []
  }

  onMount(() => { void refresh() })

  const open_count = $derived(imports.filter(row => !row.resolved_at).length)
  const question_count = $derived(imports.reduce((total, row) => total + row.open_questions, 0))

  async function copy_brief(row: AdminImportRow) {
    const { data, error } = await api_conversation_brief({ dictionary_id: row.dictionary_id, thread_id: row.thread_id })
    if (error || !data) {
      toast.error(error?.message ?? 'Could not build the brief')
      return
    }
    await navigator.clipboard.writeText(data.brief)
    toast.success('Job brief copied')
  }

  function set_assignee(row: AdminImportRow, next_user_id: string | null) {
    const admin = ADMINS.find(item => admin_user_id_by_email.get(item.email) === next_user_id)
    row.assigned_to_user_id = next_user_id
    row.assignee_name = admin?.name ?? null
    row.assignee_email = admin?.email ?? null
  }
</script>

<svelte:head><title>Imports · Admin</title></svelte:head>

<div class="imports-page">
  <header>
    <div>
      <h1>Imports</h1>
      <p class="subtitle">
        Import conversations with dictionary managers. They live on each dictionary's own Import page — both sides write there — so this is the only cross-dictionary view of what is still open.
      </p>
    </div>
    <div class="stats">
      <div><strong>{open_count}</strong><span>open</span></div>
      <div><strong>{question_count}</strong><span>questions waiting</span></div>
    </div>
  </header>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if !imports.length}
    <p class="muted">No import conversations yet.</p>
  {:else}
    <ImportsTable {imports} {admin_user_id_by_email} on_copy_brief={copy_brief} on_assigned={set_assignee} />
  {/if}
</div>

<style>
  .imports-page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 1.4rem;
    font-weight: 700;
  }
  .subtitle {
    font-size: 0.875rem;
    color: var(--color-secondary);
    line-height: 1.5;
  }
  .stats {
    display: flex;
    gap: 1.25rem;
  }
  .stats div {
    display: flex;
    flex-direction: column;
  }
  .stats strong {
    font-size: 1.35rem;
    font-weight: 700;
  }
  .stats span {
    font-size: 0.7rem;
    color: var(--color-secondary);
  }
  .muted {
    color: var(--color-secondary);
    font-size: 0.875rem;
  }
</style>
