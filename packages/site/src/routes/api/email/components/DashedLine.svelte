<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Row from './Row.svelte'

  export let row: ComponentProps<Row> = {}
</script>

<Row {...row}>
  <td align="center" style="border-bottom: 2px dashed lightgray;">
  </td>
</Row>
