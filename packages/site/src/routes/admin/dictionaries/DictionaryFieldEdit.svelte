<script lang="ts">
  import type { RowType } from '$lib/pglite/live/types'

  interface Props {
    dictionary: RowType<'dictionaries'>
    field: 'name' | 'iso_639_3' | 'glottocode' | 'location'
  }

  let { dictionary, field }: Props = $props()
</script>

<input
  value={dictionary[field]}
  oninput={e => dictionary[field] = e.currentTarget.value}
  onchange={dictionary._save} />
