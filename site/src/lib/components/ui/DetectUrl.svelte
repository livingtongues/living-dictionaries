<script>
  import { prepareDisplay, prepareHref } from '$lib/utils/detect-url'

  let { string, children } = $props()
</script>

{@render children?.({ display: prepareDisplay(string), href: prepareHref(string) })}
