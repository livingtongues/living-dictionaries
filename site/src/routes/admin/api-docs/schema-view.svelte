<script lang="ts">
  import type { SchemaNode } from './helpers'
  import Self from './schema-view.svelte'
  import { nested_object, ref_name, type_label } from './helpers'

  let { schema, depth = 0 }: { schema?: SchemaNode | boolean, depth?: number } = $props()

  const node = $derived(schema && schema !== true ? schema as SchemaNode : null)
</script>

{#snippet type_badge(prop: SchemaNode)}
  {#if prop.$ref}
    <a class="badge ref" href="#schema-{ref_name(prop.$ref)}">{ref_name(prop.$ref)}</a>
  {:else if prop.oneOf}
    {#each prop.oneOf as sub, i (i)}{#if i > 0}<span class="sep">|</span>{/if}{@render type_badge(sub)}{/each}
  {:else}
    <span class="badge">{type_label(prop)}</span>
  {/if}
{/snippet}

{#if !node}
  <span class="muted">any</span>
{:else if node.$ref}
  <a class="ref" href="#schema-{ref_name(node.$ref)}">→ {ref_name(node.$ref)}</a>
{:else if node.oneOf}
  <div class="combi">
    <span class="combi-label">one of</span>
    {#each node.oneOf as sub, i (i)}
      <div class="combi-item"><Self schema={sub} depth={depth + 1} /></div>
    {/each}
  </div>
{:else if node.allOf}
  {#each node.allOf as sub, i (i)}
    <Self schema={sub} depth={depth + 1} />
  {/each}
  {#if node.description}<p class="desc">{node.description}</p>{/if}
{:else if node.type === 'object' && node.properties}
  {#if node.description}<p class="desc">{node.description}</p>{/if}
  <ul class="props">
    {#each Object.entries(node.properties) as [key, prop] (key)}
      {@const nested = nested_object(prop)}
      <li class="prop">
        <div class="prop-head">
          <code class="prop-name">{key}</code>
          {#if node.required?.includes(key)}<span class="req">required</span>{/if}
          {@render type_badge(prop)}
        </div>
        {#if prop.description}<p class="desc">{prop.description}</p>{/if}
        {#if prop.enum}<p class="enum">enum: {prop.enum.map(v => String(v)).join(' · ')}</p>{/if}
        {#if nested && depth < 4}
          <div class="nested"><Self schema={nested} depth={depth + 1} /></div>
        {/if}
      </li>
    {/each}
  </ul>
{:else if node.type === 'array'}
  <div class="array-of">
    <span class="array-label">array of</span>
    <Self schema={node.items} depth={depth + 1} />
  </div>
{:else}
  <div class="scalar">
    <span class="badge">{type_label(node)}</span>
    {#if node.enum}<span class="enum">enum: {node.enum.map(v => String(v)).join(' · ')}</span>{/if}
  </div>
  {#if node.description}<p class="desc">{node.description}</p>{/if}
{/if}

<style>
  .props {
    list-style: none;
    margin: 0.25rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .prop {
    border-left: 2px solid var(--border-color);
    padding-left: 0.625rem;
  }
  .prop-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
  .prop-name {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color);
  }
  .badge {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-secondary);
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.3rem;
    padding: 0.05rem 0.35rem;
  }
  a.badge.ref,
  a.ref {
    color: var(--primary);
    text-decoration: none;
  }
  a.badge.ref:hover,
  a.ref:hover {
    text-decoration: underline;
  }
  a.ref {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .sep {
    color: var(--color-secondary);
    font-size: 0.72rem;
    margin: 0 0.1rem;
  }
  .req {
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--danger);
  }
  .desc {
    font-size: 0.78rem;
    color: var(--color-secondary);
    margin: 0.2rem 0 0;
    line-height: 1.5;
  }
  .enum {
    font-size: 0.72rem;
    font-family: var(--font-mono);
    color: var(--color-secondary);
    margin: 0.2rem 0 0;
  }
  .nested {
    margin-top: 0.375rem;
  }
  .combi,
  .array-of {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .combi-label,
  .array-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-secondary);
  }
  .combi-item {
    border-left: 2px solid var(--border-color);
    padding-left: 0.625rem;
  }
  .scalar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .muted {
    color: var(--color-secondary);
    font-size: 0.78rem;
  }
</style>
