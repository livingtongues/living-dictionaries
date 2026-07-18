<script>
  import { prepare_display, prepare_href } from '$lib/utils/detect-url'

  let { string, children } = $props()
</script>

{@render children?.({ display: prepare_display(string), href: prepare_href(string) })}
