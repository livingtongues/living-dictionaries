<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Row from './Row.svelte'

  interface Props {
    row?: ComponentProps<typeof Row>
    brand: string
    href: string
    src?: string
  }

  let {
    row = {},
    brand,
    href,
    src = undefined,
  }: Props = $props()
</script>

<Row {...row} space={12}>
  <td align="center" style="font-family: Helvetica, Arial, sans-serif; font-size: 20px">
    <a target="_blank" {href} style="color: white; text-decoration: none;">
      {#if src}
        <img
          {src}
          width="134"
          height="50"
          alt={brand}
          style="display:inline; color: #ffffff; font-weight:bold; font-size:36px; line-height:40px; margin: 0 auto; padding: 0;" />
      {:else}
        {brand}
      {/if}
    </a>
  </td>
</Row>
