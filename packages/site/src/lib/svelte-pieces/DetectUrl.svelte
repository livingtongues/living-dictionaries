<script lang="ts">
  import type { Snippet } from 'svelte'
  import { prepareDisplay, prepareHref } from './detectUrl'

  interface Props {
    string: string
    children: Snippet<[{ display: string, href: string | null }]>
  }

  const { string, children }: Props = $props()
</script>

{@render children({ display: prepareDisplay(string), href: prepareHref(string) })}
