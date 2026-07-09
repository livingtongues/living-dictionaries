/** Builds the JSON-LD script tag HTML (kept out of .svelte to avoid `</script>` parse issues). */
export function json_ld_html(json: string): string {
  return `<script type="application/ld+json">${json}</script>`
}
