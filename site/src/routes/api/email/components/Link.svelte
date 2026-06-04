<script lang="ts">
  interface Props {
    href: string
    color: string
    children?: import('svelte').Snippet
  }

  const { href, color, children }: Props = $props()
</script>

<a style="color: {color}" target="_blank" {href}>{@render children?.()}</a>
