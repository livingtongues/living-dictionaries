<script lang="ts">
  import IconMdiCodeJson from '~icons/mdi/code-json'
  import IconMdiRobotOutline from '~icons/mdi/robot-outline'
  import { render_markdown_to_html } from '$lib/markdown/render'
  import { sanitize_rich_text as sanitize } from '$lib/markdown/sanitize-rich-text'
  import SchemaView from './schema-view.svelte'
  import {
    build_tag_groups,
    method_color,
    request_body_contents,
    split_markdown_sections,
  } from './helpers'

  let { data } = $props()

  const spec = $derived(data.spec)
  const guides = $derived(data.guides)
  const info = $derived(spec?.info ?? {})
  const overview = $derived(split_markdown_sections(info.description ?? ''))
  const groups = $derived(build_tag_groups(spec ?? {}))
  const schemas = $derived(Object.entries(spec?.components?.schemas ?? {}) as [string, any][])
  const security_scheme = $derived(spec?.components?.securitySchemes?.bearerAuth)

  function md(markdown: string): string {
    return sanitize(render_markdown_to_html(markdown))
  }
</script>

<svelte:head><title>Agent API · Admin</title></svelte:head>

<div class="root">
  <header class="header">
    <div class="title-row">
      <IconMdiRobotOutline class="title-icon" />
      <div>
        <h1 class="page-title">{info.title ?? 'Agent API'}</h1>
        <p class="subtitle">
          The exact spec agents fetch from
          <code>/api/v1/openapi.json</code> to self-configure. Rendered live —
          {#if info.version}version {info.version}{/if}.
        </p>
      </div>
    </div>
    <div class="header-links">
      <a class="btn btn-default" href="/api/v1/openapi.json" target="_blank" rel="noreferrer">
        <IconMdiCodeJson /> Raw JSON
      </a>
    </div>
  </header>

  <div class="layout">
    <nav class="toc">
      <a href="#overview">Overview</a>
      {#if guides.length}
        <a href="#guides">Import guides <span class="count">{guides.length}</span></a>
      {/if}
      <div class="toc-heading">Endpoints</div>
      {#each groups as group (group.name)}
        <a href="#group-{group.name}" class="toc-sub">{group.name} <span class="count">{group.operations.length}</span></a>
      {/each}
      <a href="#schemas">Schemas <span class="count">{schemas.length}</span></a>
    </nav>

    <main class="content">
      <section id="overview" class="group">
        <h2 class="group-title">Overview</h2>
        {#if security_scheme}
          <div class="auth-note">
            <strong>Auth:</strong> {security_scheme.description ?? `${security_scheme.scheme} ${security_scheme.type}`}
          </div>
        {/if}
        {#if overview.intro}
          <div class="overview tw-prose">
            {@html md(overview.intro)}
          </div>
        {/if}
        {#each overview.sections as section (section.title)}
          <details class="op overview-section">
            <summary class="op-summary">
              <span class="section-title">{section.title}</span>
            </summary>
            <div class="op-body tw-prose">
              {@html md(section.body)}
            </div>
          </details>
        {/each}
      </section>

      {#if guides.length}
        <section id="guides" class="group">
          <h2 class="group-title">Import guides</h2>
          <p class="schemas-note">
            Lean format-specific guides agents fetch from <code>/api/v1/guides</code> before an import —
            grow these as real imports teach us things.
          </p>
          {#each guides as guide (guide.slug)}
            <details class="op">
              <summary class="op-summary">
                <code class="op-path">{guide.slug}</code>
                <span class="op-title">{guide.description}</span>
              </summary>
              <div class="op-body tw-prose">
                {@html md(guide.markdown)}
              </div>
            </details>
          {/each}
        </section>
      {/if}

      {#each groups as group (group.name)}
        <section id="group-{group.name}" class="group">
          <h2 class="group-title">{group.name}</h2>
          {#if group.description}
            <p class="schemas-note">{group.description}</p>
          {/if}
          {#each group.operations as op (op.method + op.path)}
            {@const bodies = request_body_contents(op.requestBody)}
            <details class="op">
              <summary class="op-summary">
                <span class="method" style="--method: {method_color(op.method)}">{op.method}</span>
                <code class="op-path">{op.path}</code>
                <span class="op-title">{op.summary ?? ''}</span>
              </summary>
              <div class="op-body">
                {#if op.description}
                  <p class="op-desc">{op.description}</p>
                {/if}

                {#if op.parameters?.length}
                  <div class="block">
                    <h4 class="block-title">Parameters</h4>
                    <ul class="params">
                      {#each op.parameters as param (param.name + param.in)}
                        <li class="param">
                          <code class="param-name">{param.name}</code>
                          <span class="param-in">{param.in}</span>
                          {#if param.required}<span class="req">required</span>{/if}
                          {#if param.schema}<span class="param-type">{param.schema.type ?? ''}{param.schema.enum ? ` (${param.schema.enum.join(' · ')})` : ''}</span>{/if}
                          {#if param.description}<p class="param-desc">{param.description}</p>{/if}
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}

                {#if bodies.length}
                  <div class="block">
                    <h4 class="block-title">Request body</h4>
                    {#each bodies as body (body.media_type)}
                      <div class="body-block">
                        <code class="media-type">{body.media_type}</code>
                        <SchemaView schema={body.schema} />
                      </div>
                    {/each}
                  </div>
                {/if}

                {#if op.responses}
                  <div class="block">
                    <h4 class="block-title">Responses</h4>
                    <ul class="responses">
                      {#each Object.entries(op.responses) as [status, res] (status)}
                        <li class="response">
                          <span class="status status-{String(status).charAt(0)}">{status}</span>
                          <span class="response-desc">{res?.description ?? ''}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
            </details>
          {/each}
        </section>
      {/each}

      <section id="schemas" class="group">
        <h2 class="group-title">Schemas</h2>
        <p class="schemas-note">Reusable object shapes referenced by the endpoints above (links jump here).</p>
        {#each schemas as [name, schema] (name)}
          <details id="schema-{name}" class="op schema">
            <summary class="op-summary">
              <code class="op-path">{name}</code>
              <span class="op-title">{schema.description ?? ''}</span>
            </summary>
            <div class="op-body">
              <SchemaView {schema} />
            </div>
          </details>
        {/each}
      </section>
    </main>
  </div>
</div>

<style>
  .root {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0.75rem;
  }
  .header {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }
  .title-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }
  :global(.title-icon) {
    font-size: 2rem;
    color: var(--primary);
    flex-shrink: 0;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 600;
  }
  .subtitle {
    font-size: 0.875rem;
    color: var(--color-secondary);
    margin-top: 0.25rem;
  }
  .subtitle code,
  .auth-note code {
    font-family: var(--font-mono);
    font-size: 0.85em;
  }
  .header-links {
    display: flex;
    gap: 0.5rem;
  }
  .header-links .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .layout {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }
  .toc {
    position: sticky;
    top: 0.75rem;
    flex-shrink: 0;
    width: 13rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    max-height: calc(100vh - 1.5rem);
    overflow-y: auto;
    padding-right: 0.25rem;
  }
  .toc a {
    font-size: 0.85rem;
    color: var(--color-secondary);
    text-decoration: none;
    padding: 0.3rem 0.55rem;
    border-radius: 0.375rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.3rem;
  }
  .toc a:hover {
    color: var(--primary);
    background: var(--surface);
  }
  .toc .toc-sub {
    padding-left: 1.1rem;
    text-transform: capitalize;
  }
  .toc-heading {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary);
    padding: 0.6rem 0.55rem 0.15rem;
  }
  .toc .count {
    font-size: 0.7rem;
    color: var(--color-secondary);
    background: var(--surface);
    border-radius: 999px;
    padding: 0 0.35rem;
  }
  .content {
    flex-grow: 1;
    min-width: 0;
  }
  @media (max-width: 760px) {
    .layout {
      flex-direction: column;
    }
    .toc {
      position: static;
      width: 100%;
      max-height: none;
      flex-direction: row;
      flex-wrap: wrap;
    }
    .toc .toc-sub {
      padding-left: 0.55rem;
    }
    .toc-heading {
      flex-basis: 100%;
      padding-top: 0.25rem;
    }
  }

  .overview {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
    max-width: none;
  }
  .overview-section .op-body {
    max-width: none;
  }
  .section-title {
    font-size: 0.9rem;
    font-weight: 600;
  }
  .auth-note {
    background: color-mix(in srgb, var(--primary), transparent 92%);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.85rem;
    margin-bottom: 0.75rem;
  }

  .group {
    margin-bottom: 2rem;
    scroll-margin-top: 1rem;
  }
  .group-title {
    font-size: 1.15rem;
    font-weight: 600;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 0.75rem;
    text-transform: capitalize;
  }
  .schemas-note {
    font-size: 0.82rem;
    color: var(--color-secondary);
    margin-bottom: 0.75rem;
  }
  .schemas-note code {
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  .op {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    margin-bottom: 0.5rem;
    scroll-margin-top: 1rem;
  }
  .op-summary {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0.875rem;
    cursor: pointer;
    list-style: none;
  }
  .op-summary::-webkit-details-marker {
    display: none;
  }
  .op-summary::before {
    content: '▸';
    color: var(--color-secondary);
    font-size: 0.75rem;
    flex-shrink: 0;
  }
  .op[open] > .op-summary::before {
    content: '▾';
  }
  .method {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--method);
    border: 1px solid var(--method);
    border-radius: 0.3rem;
    padding: 0.05rem 0.4rem;
    flex-shrink: 0;
    min-width: 3.5rem;
    text-align: center;
  }
  .op-path {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color);
    word-break: break-all;
  }
  .op-title {
    font-size: 0.82rem;
    color: var(--color-secondary);
    margin-left: auto;
    text-align: right;
  }
  .op-body {
    padding: 0 0.875rem 0.875rem;
    border-top: 1px solid var(--border-color);
    padding-top: 0.75rem;
  }
  .op-desc {
    font-size: 0.85rem;
    line-height: 1.55;
    color: var(--color);
    margin-bottom: 0.75rem;
    white-space: pre-wrap;
  }
  .block {
    margin-top: 0.875rem;
  }
  .block-title {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-secondary);
    margin-bottom: 0.4rem;
  }
  .params {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .param {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
  .param-name {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 600;
  }
  .param-in,
  .param-type {
    font-size: 0.72rem;
    font-family: var(--font-mono);
    color: var(--color-secondary);
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 0.3rem;
    padding: 0.05rem 0.35rem;
  }
  .param-desc {
    flex-basis: 100%;
    font-size: 0.78rem;
    color: var(--color-secondary);
    margin: 0.1rem 0 0;
    line-height: 1.5;
  }
  .req {
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--danger);
  }
  .body-block {
    margin-bottom: 0.75rem;
  }
  .media-type {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-secondary);
    margin-bottom: 0.375rem;
  }
  .responses {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .response {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .status {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  .status-2 { color: var(--success); }
  .status-4 { color: var(--warning); }
  .status-5 { color: var(--danger); }
  .response-desc {
    font-size: 0.8rem;
    color: var(--color-secondary);
  }
</style>
