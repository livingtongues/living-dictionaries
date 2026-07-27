<script lang="ts">
  import type { Operation } from './helpers'
  import { method_color, request_body_contents } from './helpers'
  import SchemaView from './schema-view.svelte'

  /** One OpenAPI operation, collapsed until opened. */
  const { operation }: { operation: Operation } = $props()

  const bodies = $derived(request_body_contents(operation.requestBody))
</script>

<details class="op">
  <summary class="op-summary">
    <span class="method" style="--method: {method_color(operation.method)}">{operation.method}</span>
    <code class="op-path">{operation.path}</code>
    <span class="op-title">{operation.summary ?? ''}</span>
  </summary>
  <div class="op-body">
    {#if operation.description}
      <p class="op-desc">{operation.description}</p>
    {/if}

    {#if operation.parameters?.length}
      <div class="block">
        <h4 class="block-title">Parameters</h4>
        <ul class="params">
          {#each operation.parameters as param (param.name + param.in)}
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

    {#if operation.responses}
      <div class="block">
        <h4 class="block-title">Responses</h4>
        <ul class="responses">
          {#each Object.entries(operation.responses) as [status, response] (status)}
            <li class="response">
              <span class="status status-{String(status).charAt(0)}">{status}</span>
              <span class="response-desc">{response?.description ?? ''}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</details>

<style>
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
    padding: 0.75rem 0.875rem 0.875rem;
    border-top: 1px solid var(--border-color);
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
