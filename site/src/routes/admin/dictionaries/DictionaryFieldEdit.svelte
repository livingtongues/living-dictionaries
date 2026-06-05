<script lang="ts">
  import type { RowType } from '$lib/db/client/live/types'

  type EditableField = 'name' | 'iso_639_3' | 'glottocode' | 'location'

  interface Props {
    dictionary: RowType<'dictionaries'>
    field: EditableField
    placeholder?: string
  }

  let { dictionary, field, placeholder = '' }: Props = $props()

  async function save(event: Event) {
    const { value } = event.currentTarget as HTMLInputElement
    const next = value.trim() || null
    if (dictionary[field] === next)
      return
    // `name` is NOT NULL — never blank it out.
    dictionary[field] = field === 'name' ? (next ?? dictionary.name) : next
    await dictionary._save()
  }
</script>

<input
  type="text"
  {placeholder}
  value={dictionary[field] ?? ''}
  onchange={save}
  class="field-input" />

<style>
  .field-input {
    width: 100%;
    min-width: 7rem;
    padding: 0.25rem 0.375rem;
    border-radius: 0.25rem;
    border: 1px solid transparent;
    background: transparent;
    font-size: 0.875rem;
    color: var(--color);
  }
  .field-input:hover {
    border-color: var(--border-color);
  }
  .field-input:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--background);
  }
</style>
