<script lang="ts">
  import type { SchemaInfo } from '$lib/db/introspect'
  import type { Component } from 'svelte'
  import IconMdiBookAlphabet from '~icons/mdi/book-alphabet'
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import IconMdiContentPaste from '~icons/mdi/content-paste'
  import IconMdiGraphOutline from '~icons/mdi/graph-outline'
  import IconMdiLoading from '~icons/mdi/loading'
  import IconMdiServer from '~icons/mdi/server'
  import IconMdiShieldAccountOutline from '~icons/mdi/shield-account-outline'
  import IconMdiViewList from '~icons/mdi/view-list'
  import { api_admin_schema } from '$api/admin/schema/_call'
  import { browser } from '$app/environment'
  import { onMount, tick } from 'svelte'
  import PastePane from './paste-pane.svelte'
  import SchemaCards from './schema-cards.svelte'
  import { introspect_admin_local_db } from './local-db-source.svelte.js'

  let { data } = $props()

  type SourceTab = 'shared' | 'dictionary' | 'admin' | 'paste'
  let active_tab = $state<SourceTab>('shared')

  type ViewMode = 'graph' | 'cards'
  let view_mode = $state<ViewMode>('graph')

  interface SchemaGraphProps { schema: SchemaInfo, on_node_jump?: (table_name: string) => void }
  let SchemaGraph = $state<Component<SchemaGraphProps> | null>(null)
  let graph_loading = $state(false)
  function load_graph() {
    if (SchemaGraph || !browser)
      return
    graph_loading = true
    import('./graph/schema-graph.svelte').then((module_) => {
      SchemaGraph = module_.default as unknown as Component<SchemaGraphProps>
    }).finally(() => {
      graph_loading = false
    })
  }

  function show_graph() {
    view_mode = 'graph'
    load_graph()
  }

  // Per-source lazily-loaded schema. Paste lives separately (it can be re-pasted).
  interface SourceState { schema: SchemaInfo | null, loading: boolean, error: string | null }
  const sources = $state<Record<'shared' | 'dictionary' | 'admin', SourceState>>({
    shared: { schema: null, loading: false, error: null },
    dictionary: { schema: null, loading: false, error: null },
    admin: { schema: null, loading: false, error: null },
  })
  let pasted_schema = $state<SchemaInfo | null>(null)

  const current_schema = $derived.by<SchemaInfo | null>(() => {
    if (active_tab === 'paste')
      return pasted_schema
    return sources[active_tab].schema
  })

  async function activate(tab: SourceTab) {
    active_tab = tab
    if (tab === 'paste' || !browser)
      return
    const state = sources[tab]
    if (state.schema || state.loading)
      return
    state.loading = true
    state.error = null
    try {
      if (tab === 'shared' || tab === 'dictionary') {
        const { data: response, error } = await api_admin_schema({ source: tab })
        if (error)
          throw new Error(error.message || `Error ${error.status}`)
        state.schema = response.schema
      } else {
        const user_id = data.auth_user?.user?.id
        if (!user_id)
          throw new Error('No signed-in user')
        state.schema = await introspect_admin_local_db(user_id)
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : String(err)
    } finally {
      state.loading = false
    }
  }

  onMount(() => {
    void activate('shared')
    if (view_mode === 'graph')
      load_graph()
  })

  async function on_node_jump(table_name: string) {
    view_mode = 'cards'
    await tick()
    const element = document.getElementById(`table-${table_name}`)
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
</script>

<svelte:head>
  <title>Schema · Admin</title>
</svelte:head>

<div class="page-pad">
  <div class="header-row">
    <h1 class="page-title">Schema</h1>
    {#if current_schema}
      <span class="source-tag">{current_schema.source_label}</span>
      <span class="stats">
        {current_schema.tables.length} tables · {current_schema.views.length} views · {current_schema.triggers.length} triggers
      </span>
    {/if}
  </div>

  <div class="tab-row">
    <div class="tab-group">
      <button type="button" class={['tab', { active: active_tab === 'shared' }]} onclick={() => activate('shared')}>
        <IconMdiServer style="margin-right: 0.25rem" />Server shared.db
      </button>
      <button type="button" class={['tab', { active: active_tab === 'dictionary' }]} onclick={() => activate('dictionary')}>
        <IconMdiBookAlphabet style="margin-right: 0.25rem" />Server dictionary.db
      </button>
      <button type="button" class={['tab', { active: active_tab === 'admin' }]} onclick={() => activate('admin')}>
        <IconMdiShieldAccountOutline style="margin-right: 0.25rem" />Local admin.db
      </button>
      <button type="button" class={['tab', { active: active_tab === 'paste' }]} onclick={() => activate('paste')}>
        <IconMdiContentPaste style="margin-right: 0.25rem" />Paste SQL
      </button>
    </div>
    <div class="view-tabs">
      <button type="button" class={['view-tab', { active: view_mode === 'graph' }]} onclick={show_graph}>
        <IconMdiGraphOutline style="margin-right: 0.25rem" />Graph
      </button>
      <button type="button" class={['view-tab', { active: view_mode === 'cards' }]} onclick={() => view_mode = 'cards'}>
        <IconMdiViewList style="margin-right: 0.25rem" />Cards
      </button>
    </div>
  </div>

  {#if active_tab === 'paste' && !pasted_schema}
    <PastePane on_loaded={schema => pasted_schema = schema} />
  {:else if active_tab !== 'paste' && sources[active_tab].loading}
    <div class="loading-row">
      <IconMdiLoading class="spin" style="margin-right: 0.25rem" />Introspecting…
    </div>
  {:else if active_tab !== 'paste' && sources[active_tab].error}
    <div class="local-error">{sources[active_tab].error}</div>
  {:else if !current_schema}
    <p class="muted">No schema loaded.</p>
  {:else}
    {#if active_tab === 'paste' && pasted_schema}
      <div class="paste-reset-row">
        <button type="button" class="btn-ghost btn-sm" onclick={() => pasted_schema = null}>
          <IconMdiArrowLeft style="margin-right: 0.25rem" />Paste different SQL
        </button>
      </div>
    {/if}
    {#if view_mode === 'graph'}
      <div class="graph-frame">
        {#if SchemaGraph}
          <SchemaGraph schema={current_schema} {on_node_jump} />
        {:else if graph_loading}
          <div class="graph-loading">
            <IconMdiLoading class="spin" style="margin-right: 0.5rem" />Loading graph…
          </div>
        {:else}
          <div class="graph-loading">Initializing…</div>
        {/if}
      </div>
    {:else}
      <SchemaCards schema={current_schema} />
    {/if}
  {/if}
</div>

<style>
  .page-pad {
    padding: 1.5rem;
  }
  .header-row {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }
  .source-tag {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--surface);
    color: var(--color-secondary);
    font-family: var(--font-mono);
  }
  .stats {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .muted {
    color: var(--color-secondary);
  }

  .tab-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.75rem;
  }
  .tab-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .tab {
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: background-color 0.15s, color 0.15s;
    border: none;
    cursor: pointer;
    background: transparent;
    color: var(--color-secondary);
  }
  .tab:hover {
    background: var(--surface);
  }
  .tab.active {
    background: var(--primary);
    color: var(--on-primary);
    font-weight: 500;
  }

  .view-tabs {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
    padding: 0.125rem;
  }
  .view-tab {
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: background-color 0.15s, color 0.15s;
    border: none;
    cursor: pointer;
    background: transparent;
    color: var(--color-secondary);
  }
  .view-tab:hover {
    background: var(--surface);
  }
  .view-tab.active {
    background: var(--surface);
    color: var(--color);
    font-weight: 500;
  }

  .loading-row {
    font-size: 0.875rem;
    color: var(--color-secondary);
  }
  :global(.spin) {
    animation: schema-spin 1s linear infinite;
  }
  @keyframes schema-spin {
    to { transform: rotate(360deg); }
  }
  .local-error {
    font-size: 0.875rem;
    color: var(--danger);
    font-family: var(--font-mono);
  }
  .paste-reset-row {
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .graph-frame {
    height: calc(100vh - 3.5rem - 3rem - 3rem - 3rem);
    min-height: 400px;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
    background: var(--background);
  }
  .graph-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    color: var(--color-secondary);
  }
</style>
