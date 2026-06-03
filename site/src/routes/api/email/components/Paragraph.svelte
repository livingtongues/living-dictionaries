<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Row from './Row.svelte'

  export let row: ComponentProps<Row> = {}
</script>

<Row {...row}>
  <td align="left" style="font-size: 16px; line-height: 25px; font-family: Helvetica, Arial, sans-serif; color: #666666;">
    <slot />
  </td>
</Row>
