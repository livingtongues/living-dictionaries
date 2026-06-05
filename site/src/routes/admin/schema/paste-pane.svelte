<script lang="ts">
  import type { SchemaInfo } from '$lib/db/introspect'
  import IconMdiDatabaseArrowRight from '~icons/mdi/database-arrow-right'
  import IconMdiLoading from '~icons/mdi/loading'
  import { api_admin_schema_from_sql } from '$api/admin/schema-from-sql/_call'

  let { on_loaded }: { on_loaded: (schema: SchemaInfo) => void } = $props()
  let sql = $state('')
  let label = $state('')
  let busy = $state(false)
  let error_message = $state<string | null>(null)

  async function submit() {
    if (busy || !sql.trim())
      return
    busy = true
    error_message = null
    const { data, error } = await api_admin_schema_from_sql({
      sql,
      label: label.trim() || undefined,
    })
    busy = false
    if (error) {
      error_message = error.message || `Error ${error.status}`
      return
    }
    on_loaded(data.schema)
  }
</script>

<div class="paste-pane">
  <p class="muted">
    Paste any SQLite migration / dump. Loaded into a fresh <span class="mono">:memory:</span> DB and introspected. Nothing persists.
  </p>
  <input type="text" bind:value={label} placeholder="Optional label (e.g. 'house schema')" class="text-input" />
  <textarea bind:value={sql} placeholder="-- paste a CREATE TABLE ... here" class="sql-textarea"></textarea>
  {#if error_message}
    <div class="error-msg">{error_message}</div>
  {/if}
  <div class="action-row">
    <button type="button" class="btn btn-default" disabled={busy || !sql.trim()} onclick={submit}>
      {#if busy}
        <IconMdiLoading class="spin" style="margin-right: 0.25rem" />Loading…
      {:else}
        <IconMdiDatabaseArrowRight style="margin-right: 0.25rem" />Introspect
      {/if}
    </button>
    {#if sql}
      <button type="button" class="btn-ghost btn-sm" disabled={busy} onclick={() => { sql = ''; label = ''; error_message = null }}>
        Clear
      </button>
    {/if}
  </div>
</div>

<style>
  .paste-pane > * + * {
    margin-top: 0.75rem;
  }
  .muted {
    font-size: 0.875rem;
    color: var(--color-secondary);
  }
  .mono {
    font-family: var(--font-mono);
  }
  .text-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
    font-size: 0.875rem;
  }
  .sql-textarea {
    width: 100%;
    height: 18rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.375;
  }
  .error-msg {
    font-size: 0.875rem;
    color: var(--danger);
    font-family: var(--font-mono);
    white-space: pre-wrap;
  }
  .action-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  :global(.spin) {
    animation: paste-spin 1s linear infinite;
  }
  @keyframes paste-spin {
    to { transform: rotate(360deg); }
  }
</style>
