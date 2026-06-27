<script lang="ts">
  import { marked } from 'marked'
  import { diff_markdown } from '$lib/components/legal-review/legal-diff'
  import terms_before from '$lib/legal/before/terms-before.md?raw'
  import privacy_before from '$lib/legal/before/privacy-before.md?raw'
  import terms_after from '$lib/legal/terms-of-use.md?raw'
  import privacy_after from '$lib/legal/privacy-policy.md?raw'

  const docs = [
    {
      title: 'Terms of Use',
      before_label: 'BEFORE — live Termly version (2019)',
      after_label: 'AFTER — proposed rewrite',
      live_href: '/terms',
      rows: diff_markdown(terms_before, terms_after),
    },
    {
      title: 'Privacy Policy',
      before_label: 'BEFORE — none existed (linked the Living Tongues site policy)',
      after_label: 'AFTER — proposed new policy',
      live_href: '/privacy-policy',
      rows: diff_markdown(privacy_before, privacy_after),
    },
  ]

  function render(block: string | null): string {
    if (!block)
      return ''
    return marked.parse(block, { async: false }) as string
  }

  function changed_count(rows: { changed: boolean }[]): number {
    return rows.filter(row => row.changed).length
  }
</script>

<div class="legal-review">
  <header class="intro">
    <h1>Legal review</h1>
    <p>
      Side-by-side comparison of the current and proposed <strong>Terms of Use</strong> and
      <strong>Privacy Policy</strong>. Changed, added, and removed passages are
      <mark>highlighted in yellow</mark>. Share this page with Greg — it's reachable by any admin.
      The published pages render at <a href="/terms" target="_blank">/terms</a> and
      <a href="/privacy-policy" target="_blank">/privacy-policy</a>.
    </p>
  </header>

  {#each docs as doc (doc.title)}
    <section class="doc">
      <div class="doc-head">
        <h2>{doc.title}</h2>
        <span class="badge">{changed_count(doc.rows)} changed passages</span>
        <a class="live" href={doc.live_href} target="_blank">view published →</a>
      </div>

      <div class="cols-head">
        <div>{doc.before_label}</div>
        <div>{doc.after_label}</div>
      </div>

      <div class="diff">
        {#each doc.rows as row, i (i)}
          <div class="cell before" class:changed={row.changed} class:empty={!row.left}>
            {@html render(row.left)}
          </div>
          <div class="cell after" class:changed={row.changed} class:empty={!row.right}>
            {@html render(row.right)}
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .legal-review {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem 1rem 4rem;
    color: var(--color);
  }

  .intro h1 {
    font-size: 1.6rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
  }
  .intro p {
    max-width: 60rem;
    line-height: 1.6;
    color: var(--color-secondary);
  }
  .intro a {
    color: var(--primary);
    text-decoration: underline;
  }

  .doc {
    margin-top: 2.5rem;
  }
  .doc-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .doc-head h2 {
    font-size: 1.3rem;
    font-weight: 700;
    margin: 0;
  }
  .badge {
    font-size: 0.8rem;
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    color: var(--primary);
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    font-weight: 600;
  }
  .live {
    font-size: 0.85rem;
    color: var(--primary);
    text-decoration: underline;
    margin-left: auto;
  }

  .cols-head,
  .diff {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
  }
  .cols-head {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--surface);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--color-secondary);
  }
  .cols-head div {
    padding: 0.5rem 0.75rem;
    border-bottom: 2px solid var(--border-color);
  }

  .diff {
    background: var(--border-color);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  .cell {
    background: var(--background);
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  .cell.changed {
    background: #fef08a; /* yellow-200 */
  }
  .cell.empty {
    background: #f8fafc; /* slate-50 — visibly "nothing here" */
  }
  .cell.changed.empty {
    background: #fef9c3; /* yellow-100 — a removed/added counterpart */
  }

  .cell :global(h1) { font-size: 1.15rem; font-weight: 700; margin: 0.2rem 0; }
  .cell :global(h2) { font-size: 1.05rem; font-weight: 700; margin: 0.2rem 0; }
  .cell :global(h3) { font-size: 0.98rem; font-weight: 600; margin: 0.2rem 0; }
  .cell :global(p) { margin: 0.1rem 0; }
  .cell :global(ul),
  .cell :global(ol) { padding-left: 1.2rem; margin: 0.1rem 0; }
  .cell :global(li) { list-style: disc; margin: 0.1rem 0; }
  .cell :global(strong) { font-weight: 700; }
  .cell :global(em) { font-style: italic; color: var(--color-secondary); }
  .cell :global(a) { color: var(--primary); text-decoration: underline; word-break: break-word; }
</style>
