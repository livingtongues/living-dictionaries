<script lang="ts">
  import AgentCall from './agent-call.svelte'
  import InlineCode from './inline-code.svelte'
  import { method_color } from './helpers'

  let { data } = $props()
  const doc = $derived(data.front_door)

  /** `/api/v1/guides/importing` → the human mirror of that same guide. */
  function guide_href(slug: string): string {
    return `/admin/api-docs/guides/${slug}`
  }

  /** Strip the origin so the path reads like the spec. */
  function path_of(url: string): string {
    return url.replace(/^https?:\/\/[^/]+/, '')
  }

  function human_href(url: string): string {
    const path = path_of(url)
    const guide = path.match(/^\/api\/v1\/guides\/(.+)$/)
    return guide ? guide_href(guide[1]) : path
  }
</script>

<AgentCall path="/api/v1" note="Small, task-routing, and cacheable. An agent presenting its API key also gets its dictionary named and a suggested starting task." />

<p class="lede">{doc.what}</p>
<div class="start"><InlineCode text={doc.start} /></div>

<h2 class="section-title">Pick your job</h2>
<div class="tasks">
  {#each doc.tasks as task (task.id)}
    <section class="task">
      <div class="task-head"><span class="task-id">{task.id}</span></div>
      <h3 class="task-title">{task.title}</h3>
      <p class="task-when"><InlineCode text={task.when} /></p>

      {#if task.guides.length}
        <div class="guides">
          {#each task.guides as guide, index (guide.slug)}
            <a href={guide_href(guide.slug)} class="guide" class:primary={index === 0}>
              {index === 0 ? 'Read first: ' : ''}{guide.slug}
            </a>
          {/each}
        </div>
      {/if}

      <ul class="calls">
        {#each task.next as call (call.url)}
          <li>
            <a class="call" href={human_href(call.url)}>
              <span class="method" style="--method: {method_color(call.method.toLowerCase())}">{call.method}</span>
              <code class="call-path">{path_of(call.url)}</code>
            </a>
            <span class="why"><InlineCode text={call.why} /></span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<h2 class="section-title">Endpoint reference</h2>
<p class="ref-note"><InlineCode text={doc.reference.note} /></p>
<div class="ref-links">
  <a class="btn btn-primary" href="/admin/api-docs/reference">Browse the index</a>
  <a class="btn btn-default" href={path_of(doc.reference.full)} target="_blank" rel="noreferrer">Raw JSON (full)</a>
</div>

<style>
  .lede {
    font-size: 0.95rem;
    margin-bottom: 0.5rem;
  }
  .start {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 0.85rem 1rem;
    font-size: 0.88rem;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }
  .section-title {
    font-size: 1.15rem;
    font-weight: 600;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 0.75rem;
  }
  .tasks {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
    gap: 0.75rem;
    margin-bottom: 2rem;
  }
  .task {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.6rem;
    padding: 0.85rem 1rem;
  }
  .task-head {
    margin-bottom: 0.35rem;
  }
  .task-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
  }
  .task-id {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--primary);
    border: 1px solid var(--primary);
    border-radius: 0.3rem;
    padding: 0 0.35rem;
  }
  .task-when {
    font-size: 0.84rem;
    line-height: 1.55;
    color: var(--color-secondary);
    margin-bottom: 0.6rem;
  }
  .guides {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.6rem;
  }
  .guide {
    font-size: 0.78rem;
    text-decoration: none;
    border: 1px solid var(--border-color);
    border-radius: 0.35rem;
    padding: 0.15rem 0.45rem;
    color: var(--color-secondary);
  }
  .guide:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
  .guide.primary {
    font-weight: 700;
    color: var(--primary);
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary), transparent 92%);
  }
  .calls {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .call {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    text-decoration: none;
  }
  .method {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--method);
    border: 1px solid var(--method);
    border-radius: 0.3rem;
    padding: 0 0.35rem;
  }
  .call-path {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color);
    word-break: break-all;
  }
  .call:hover .call-path {
    color: var(--primary);
  }
  .why {
    display: block;
    font-size: 0.78rem;
    color: var(--color-secondary);
    line-height: 1.5;
  }
  .ref-note {
    font-size: 0.85rem;
    color: var(--color-secondary);
    margin-bottom: 0.75rem;
  }
  .ref-links {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 2rem;
  }
</style>
