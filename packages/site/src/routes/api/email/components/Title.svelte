<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import Row from './Row.svelte'

  interface Props {
    row?: ComponentProps<Row>;
    text: string;
    fontSize?: number;
  }

  let { row = {}, text, fontSize = 28 }: Props = $props();
</script>

<Row {...row}>
  <td align="center" style="font-size: {fontSize}px; font-family: Helvetica, Arial, sans-serif; color: #333333;">
    {text}
  </td>
</Row>
