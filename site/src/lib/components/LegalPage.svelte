<script lang="ts">
  import { marked } from 'marked'

  interface Props {
    md: string
  }

  let { md }: Props = $props()

  const html = marked.parse(md, { async: false }) as string
</script>

<article class="legal-content" style="direction: ltr">
  {@html html}
</article>

<style>
  .legal-content {
    max-width: 48rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    color: var(--color);
    line-height: 1.65;
  }
  .legal-content :global(h1) { font-size: 1.75rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
  .legal-content :global(h2) { font-size: 1.35rem; font-weight: 600; margin: 2rem 0 0.75rem; border-left: 4px solid var(--primary); padding-left: 0.75rem; }
  .legal-content :global(h3) { font-size: 1.1rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
  .legal-content :global(p) { margin: 0.65rem 0; }
  .legal-content :global(ul),
  .legal-content :global(ol) { padding-left: 1.5rem; margin: 0.65rem 0; }
  .legal-content :global(li) { margin: 0.3rem 0; }
  .legal-content :global(ul li) { list-style: disc; }
  .legal-content :global(ol li) { list-style: decimal; }
  .legal-content :global(strong) { font-weight: 600; }
  .legal-content :global(em) { font-style: italic; color: var(--color-secondary); }
  .legal-content :global(hr) { border: none; border-top: 1px solid var(--border-color); margin: 1.5rem 0; }
  .legal-content :global(a) { color: var(--primary); text-decoration: underline; word-break: break-word; }
</style>
