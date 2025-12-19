<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Row from './Row.svelte'

  interface Props {
    row?: ComponentProps<Row>;
    children?: import('svelte').Snippet;
  }

  let { row = {}, children }: Props = $props();
</script>

<Row {...row}>
  <td align="left" style="font-size: 16px; line-height: 25px; font-family: Helvetica, Arial, sans-serif; color: #666666;">
    {@render children?.()}
  </td>
</Row>
