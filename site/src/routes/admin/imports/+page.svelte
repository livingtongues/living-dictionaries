<script lang="ts">
  import type { AdminImportRow } from '$api/admin/imports/+server'
  import IconMdiCheckCircleOutline from '~icons/mdi/check-circle-outline'
  import IconMdiClipboardTextOutline from '~icons/mdi/clipboard-text-outline'
  import IconMdiLockOutline from '~icons/mdi/lock-outline'
  import { api_admin_imports_list } from '$api/admin/imports/_call'
  import { api_conversation_brief } from '$api/v1/dictionaries/[id]/conversations/_call'
  import { toast } from '$lib/state/toast.svelte'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'

  let imports = $state<AdminImportRow[]>([])
  let loading = $state(true)
  let show_resolved = $state(false)

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

  const visible = $derived(
    imports.filter(row => show_resolved || !row.resolved_at || row.has_activity_since_resolve),
  )
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

  function conversation_href(row: AdminImportRow): string {
    return `/${row.dictionary_url ?? row.dictionary_id}/import/${row.thread_id}`
  }
</script>

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

  <label class="toggle">
    <input type="checkbox" bind:checked={show_resolved} />
    Show resolved
  </label>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if !visible.length}
    <p class="muted">No import conversations{show_resolved ? '' : ' need attention'}.</p>
  {:else}
    <div class="table">
      {#each visible as row (row.thread_id)}
        <div class="row" class:resolved={!!row.resolved_at}>
          <div class="cell dict">
            <a href={conversation_href(row)}>{row.dictionary_name ?? row.dictionary_id}</a>
            <span class="who">{row.requester_name || row.requester_email}</span>
          </div>

          <div class="cell state">
            {#if row.resolved_at}
              <span class="pill done"><IconMdiCheckCircleOutline /> Resolved</span>
              {#if row.has_activity_since_resolve}
                <span class="pill alert">new activity</span>
              {/if}
            {:else if row.started_at}
              <span class="pill active">In progress</span>
            {:else}
              <span class="pill">Not started</span>
            {/if}
            {#if row.started_at}
              <span class="pill muted" title="Resources are frozen"><IconMdiLockOutline /></span>
            {/if}
          </div>

          <div class="cell counts">
            <span>{row.resource_count} file{row.resource_count === 1 ? '' : 's'}</span>
            {#if row.artifact_count}<span>{row.artifact_count} report{row.artifact_count === 1 ? '' : 's'}</span>{/if}
            {#if row.open_questions}
              <span class="waiting">{row.open_questions} unanswered</span>
            {:else if row.answered_questions}
              <span class="answered">{row.answered_questions} answered</span>
            {/if}
          </div>

          <div class="cell assignee">{row.assignee_name || row.assignee_email || '—'}</div>

          <div class="cell when" title={format_date_time(row.last_message_at)}>
            {format_relative_time(row.last_message_at)}
          </div>

          <div class="cell actions">
            <button type="button" class="btn btn-sm" title="Copy the agent-ready job brief" onclick={() => copy_brief(row)}>
              <IconMdiClipboardTextOutline />
            </button>
          </div>
        </div>
      {/each}
    </div>
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
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    align-self: flex-start;
  }
  .table {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(11rem, 2fr) auto minmax(8rem, 1fr) minmax(6rem, 1fr) auto auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.8rem;
    border: 1px solid color-mix(in srgb, var(--color) 12%, var(--background));
    border-radius: 0.7rem;
    background: var(--surface);
  }
  .row.resolved {
    opacity: 0.72;
  }
  .dict a {
    font-weight: 600;
    font-size: 0.9rem;
  }
  .dict a:hover {
    color: var(--primary);
  }
  .who {
    display: block;
    font-size: 0.74rem;
    color: var(--color-secondary);
  }
  .state {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--primary), transparent 88%);
    color: var(--primary);
    white-space: nowrap;
  }
  .pill.active {
    background: color-mix(in srgb, var(--warning), transparent 86%);
    color: var(--warning);
  }
  .pill.done {
    background: color-mix(in srgb, var(--success), transparent 86%);
    color: var(--success);
  }
  .pill.alert {
    background: color-mix(in srgb, var(--danger), transparent 86%);
    color: var(--danger);
  }
  .pill.muted {
    background: color-mix(in srgb, var(--color) 8%, var(--background));
    color: var(--color-secondary);
  }
  .counts {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .waiting {
    color: var(--primary);
    font-weight: 700;
  }
  .answered {
    color: var(--success);
    font-weight: 600;
  }
  .assignee,
  .when {
    font-size: 0.78rem;
    color: var(--color-secondary);
  }
  .muted {
    color: var(--color-secondary);
    font-size: 0.875rem;
  }
  @media (max-width: 720px) {
    .row {
      grid-template-columns: 1fr auto;
    }
    .assignee,
    .when {
      display: none;
    }
  }
</style>
