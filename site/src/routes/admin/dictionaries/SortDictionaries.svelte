<script lang="ts">
  import type { DictionaryWithHelpers } from './dictionaryWithHelpers.types'

  export let dictionaries: DictionaryWithHelpers[] = []

  enum DictionaryFields {
    name = 'Dictionary Name',
    public = 'Public',
    entry_count = 'Entries',
    managers = 'Managers',
    contributors = 'Contributors',
    iso_639_3 = 'ISO 639-3',
    glottocode = 'Glottocode',
    coordinates = 'Coordinates',
    location = 'Location',
    gloss_languages = 'Gloss Languages',
    alternate_names = 'Alternate Names',
    orthographies = 'Alternate Orthographies',
    created_at = 'Created At',
    updated_at = 'Updated At',
    language_used_by_community = 'Language Used by Community',
    community_permission = 'Community Permission',
    author_connection = 'Author Connection',
    con_language_description = 'Conlang Description',
    conlang = 'Conlang',
    deleted = 'Delete',
  }

  type SortFields = keyof typeof DictionaryFields
  // @ts-ignore
  const dictionary_fields: {
    key: SortFields
    value: DictionaryFields
  }[] = Object.entries(DictionaryFields).map(([key, value]) => {
    return { key, value }
  })

  let sortKey: SortFields = 'name'
  let sortDescending = true
  $: keep_null_date_at_end = sortDescending ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER

  $: sortedDictionaries = dictionaries.sort((a, b) => {
    let valueA: string | number
    let valueB: string | number
    // prettier-ignore
    switch (sortKey) {
      case 'managers':
        valueA = a.editors?.filter(({ dictionary_roles }) => dictionary_roles.some(({ role }) => role === 'manager')).length || 0
        valueB = b.editors?.filter(({ dictionary_roles }) => dictionary_roles.some(({ role }) => role === 'manager')).length || 0
        break
      case 'contributors':
        valueA = a.editors?.filter(({ dictionary_roles }) => dictionary_roles.some(({ role }) => role === 'contributor')).length || 0
        valueB = b.editors?.filter(({ dictionary_roles }) => dictionary_roles.some(({ role }) => role === 'contributor')).length || 0
        break
      case 'language_used_by_community':
        valueA = a.language_used_by_community?.toString() || ''
        valueB = b.language_used_by_community?.toString() || ''
        break
      case 'entry_count':
        valueA = a.entry_count || 0
        valueB = b.entry_count || 0
        break
      case 'coordinates':
        valueA = a.coordinates?.points?.[0]?.coordinates.latitude || 0
        valueB = b.coordinates?.points?.[0]?.coordinates.latitude || 0
        break
      case 'gloss_languages':
        valueA = a.gloss_languages?.length || 0
        valueB = b.gloss_languages?.length || 0
        break
      case 'alternate_names':
        valueA = a.alternate_names?.length || 0
        valueB = b.alternate_names?.length || 0
        break
      case 'orthographies':
        valueA = a.orthographies?.length || 0
        valueB = b.orthographies?.length || 0
        break
      case 'created_at':
        valueA = a.created_at ? new Date(a.created_at).getTime() : keep_null_date_at_end
        valueB = b.created_at ? new Date(b.created_at).getTime() : keep_null_date_at_end
        break
      case 'updated_at':
        valueA = a.updated_at ? new Date(a.updated_at).getTime() : keep_null_date_at_end
        valueB = b.updated_at ? new Date(b.updated_at).getTime() : keep_null_date_at_end
        break
      default:
        valueA = typeof a[sortKey] === 'string' ? (a[sortKey] as string).toUpperCase() : 'zz' // if we ever have missing names or email, then pass 'zz' when the sortKey is undefined
        valueB = typeof b[sortKey] === 'string' ? (b[sortKey] as string).toUpperCase() : 'zz'
    // a[sortKey].localeCompare(b[sortKey])
    }
    if (valueA < valueB)
      return sortDescending ? -1 : 1

    if (valueA > valueB)
      return sortDescending ? 1 : -1

    return 0
  })

  function setSortSettings(paraSortKey: SortFields) {
    // Changes the key if the sort wasn't based on the button before, and if it was, change the direction
    if (sortKey === paraSortKey)
      sortDescending = !sortDescending
    else
      sortKey = paraSortKey
  }
</script>

<thead>
  {#each dictionary_fields as field}
    <th
      class="cursor-pointer"
      on:click={() => setSortSettings(field.key)}
      title="Click to sort asc/desc">
      {field.value}
      {#if sortKey === field.key}
        {#if sortDescending}
          <i class="fas fa-sort-amount-down" />
        {:else}
          <i class="fas fa-sort-amount-up" />
        {/if}
      {/if}
    </th>
  {/each}
</thead>

<slot {sortedDictionaries} />

<style>
  th {
    --at-apply: text-xs font-semibold text-gray-600 uppercase tracking-wider;
  }
</style>
