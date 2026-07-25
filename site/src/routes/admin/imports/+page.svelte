<script lang="ts">
  import type { AdminImportRow } from '$api/admin/imports/+server'
  import { api_admin_imports_list } from '$api/admin/imports/_call'
  import { api_conversation_brief } from '$api/v1/dictionaries/[id]/conversations/_call'
  import ImportsTable from '$lib/import/admin/ImportsTable.svelte'
  import { toast } from '$lib/state/toast.svelte'

  let imports = $state<AdminImportRow[]>([])
  let loading = $state(true)

  async function refresh() {
    const { data, error } = await api_admin_imports_list()
    loading = false
    if (error) {
      toast.error(error.message)
      return
    }
    imports = data?.imports ?? []
  }

  $effect(() => { void refresh() })

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
    <ImportsTable {imports} on_copy_brief={copy_brief} />
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
