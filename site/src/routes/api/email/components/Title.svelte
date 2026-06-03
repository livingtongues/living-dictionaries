<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Row from './Row.svelte'

  export let row: ComponentProps<Row> = {}
  export let text: string
  export let fontSize = 28
</script>

<Row {...row}>
  <td align="center" style="font-size: {fontSize}px; font-family: Helvetica, Arial, sans-serif; color: #333333;">
    {text}
  </td>
</Row>
