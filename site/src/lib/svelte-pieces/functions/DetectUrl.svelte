<script>
  import { prepareDisplay, prepareHref } from './detectUrl'

  let { string, children } = $props()
</script>

{@render children?.({ display: prepareDisplay(string), href: prepareHref(string) })}
