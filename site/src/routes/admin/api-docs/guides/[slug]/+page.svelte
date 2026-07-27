<script lang="ts">
  import { render_markdown_to_html } from '$lib/markdown/render'
  import { sanitize_rich_text as sanitize } from '$lib/markdown/sanitize-rich-text'
  import IconMdiChevronLeft from '~icons/mdi/chevron-left'
  import IconMdiChevronRight from '~icons/mdi/chevron-right'
  import AgentCall from '../../agent-call.svelte'
  import { split_markdown_sections } from '../../helpers'

  let { data } = $props()

  const kb = $derived(Math.round(data.markdown.length / 102.4) / 10)

  /**
   * Split on `## ` so the longest guide (the 49 KB import runbook) gets a jump
   * list instead of being one unnavigable wall.
   */
  const document = $derived(split_markdown_sections(data.markdown))

  function md(markdown: string): string {
    return sanitize(render_markdown_to_html(markdown))
  }
  function anchor(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
</script>

<svelte:head><title>{data.guide?.title ?? data.slug} · Agent API</title></svelte:head>

<AgentCall path="/api/v1/guides/{data.slug}" note="Public. Returns raw markdown — {kb} KB, exactly the text below." />

{#if document.sections.length > 2}
  <nav class="toc">
    {#each document.sections as section (section.title)}
      <a href="#{anchor(section.title)}">{section.title}</a>
    {/each}
  </nav>
{/if}

<article class="guide tw-prose">
  {@html md(document.intro)}
  {#each document.sections as section (section.title)}
    <section id={anchor(section.title)}>
      <h2>{section.title}</h2>
      {@html md(section.body)}
    </section>
  {/each}
</article>

<nav class="neighbours">
  {#if data.previous}
    <a class="neighbour" href="/admin/api-docs/guides/{data.previous.slug}">
      <IconMdiChevronLeft /> {data.previous.slug}
    </a>
  {:else}
    <span></span>
  {/if}
  <a class="all" href="/admin/api-docs/guides">All guides</a>
  {#if data.next}
    <a class="neighbour next" href="/admin/api-docs/guides/{data.next.slug}">
      {data.next.slug} <IconMdiChevronRight />
    </a>
  {:else}
    <span></span>
  {/if}
</nav>

<style>
  .toc {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.9rem;
  }
  .toc a {
    font-size: 0.76rem;
    text-decoration: none;
    color: var(--color-secondary);
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.35rem;
    padding: 0.15rem 0.45rem;
  }
  .toc a:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
  .guide section {
    scroll-margin-top: 0.75rem;
  }
  .guide {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1.25rem 1.5rem;
    max-width: none;
  }
  /*
    tw-prose renders literal backticks around inline code (the Tailwind default).
    Fine for a manager's entry note; unreadable in a guide that is half `code`.
    Overridden here only — never touch the global rule.
  */
  .guide :global(code)::before,
  .guide :global(code)::after {
    content: none;
  }
  .guide :global(:not(pre) > code) {
    background: color-mix(in srgb, var(--color) 8%, transparent);
    border-radius: 0.25rem;
    padding: 0.05em 0.3em;
  }
  .neighbours {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 1rem 0 2rem;
    font-size: 0.85rem;
  }
  .neighbour {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-family: var(--font-mono);
    text-decoration: none;
  }
  .all {
    color: var(--color-secondary);
    text-decoration: none;
  }
  .all:hover {
    color: var(--primary);
  }
</style>
