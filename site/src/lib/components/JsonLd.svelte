<script lang="ts">
  import { json_ld_html } from './json-ld-html'

  /**
   * Renders a schema.org JSON-LD block into <head> so search engines and AI answer
   * engines can parse the page as structured data (entries → DefinedTerm, a dictionary →
   * DefinedTermSet, the site → WebSite/Organization).
   *
   * `<` is escaped to \u003C so user content can never break out of the script tag
   * (a literal closing script tag in content would otherwise end the block early);
   * JSON.stringify handles the rest.
   */
  const { data }: { data: Record<string, unknown> | Record<string, unknown>[] } = $props()

  const json = $derived(JSON.stringify(data).replaceAll('<', '\\u003C'))
  const ld_json_html = $derived(json_ld_html(json))
</script>

<svelte:head>
  {@html ld_json_html}
</svelte:head>
