<script lang="ts">
  import IconMdiCodeJson from '~icons/mdi/code-json'
  import IconMdiRobotOutline from '~icons/mdi/robot-outline'
  import { render_markdown_to_html } from '$lib/markdown/render'
  import { sanitize_rich_text as sanitize } from '$lib/markdown/sanitize-rich-text'
  import SchemaView from './schema-view.svelte'
  import {
    build_groups,
    method_color,
    request_body_contents,
  } from './helpers'

  let { data } = $props()

  const spec = $derived(data.spec)
  const info = $derived(spec?.info ?? {})
  const description_html = $derived(info.description ? sanitize(render_markdown_to_html(info.description)) : '')
  const groups = $derived(build_groups(spec?.paths ?? {}))
  const schemas = $derived(Object.entries(spec?.components?.schemas ?? {}) as [string, any][])
  const security_scheme = $derived(spec?.components?.securitySchemes?.bearerAuth)
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

  {#if description_html}
    <section class="overview tw-prose">
      {@html description_html}
    </section>
  {/if}

  {#if security_scheme}
    <section class="auth-note">
      <strong>Auth:</strong> {security_scheme.description ?? `${security_scheme.scheme} ${security_scheme.type}`}
    </section>
  {/if}

  <nav class="jump">
    {#each groups as group (group.label)}
      <a href="#group-{group.label}">{group.label} <span class="count">{group.operations.length}</span></a>
    {/each}
    <a href="#schemas">Schemas <span class="count">{schemas.length}</span></a>
  </nav>

  {#each groups as group (group.label)}
    <section id="group-{group.label}" class="group">
      <h2 class="group-title">{group.label}</h2>
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
</div>

<style>
  .root {
    width: 100%;
    max-width: 1000px;
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

  .overview {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.25rem;
    max-width: none;
  }
  .auth-note {
    background: color-mix(in srgb, var(--primary), transparent 92%);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }

  .jump {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 1.5rem;
  }
  .jump a {
    font-size: 0.8rem;
    color: var(--color-secondary);
    text-decoration: none;
    padding: 0.2rem 0.55rem;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .jump a:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
  .jump .count {
    font-size: 0.7rem;
    color: var(--color-secondary);
    background: var(--surface);
    border-radius: 999px;
    padding: 0 0.35rem;
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
  }
  .schemas-note {
    font-size: 0.82rem;
    color: var(--color-secondary);
    margin-bottom: 0.75rem;
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
