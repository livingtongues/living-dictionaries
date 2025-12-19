<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Row from './Row.svelte'

  interface Props {
    row?: ComponentProps<typeof Row>
  }

  let { row = {} }: Props = $props()
</script>

<Row {...row}>
  <td align="center" style="border-bottom: 2px dashed lightgray;">
  </td>
</Row>
