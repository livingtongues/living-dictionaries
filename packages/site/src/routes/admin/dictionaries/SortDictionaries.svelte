<script lang="ts">
  import type { DictionaryWithHelperStores } from './dictionaryWithHelpers'

  export let dictionaries: DictionaryWithHelperStores[] = []

  enum DictionaryFields {
    // eslint-disable-next-line no-unused-vars
    name = 'Dictionary Name',
    // eslint-disable-next-line no-unused-vars
    public = 'Public',
    // eslint-disable-next-line no-unused-vars
    entry_count = 'Entries',
    // eslint-disable-next-line no-unused-vars
    managers = 'Managers',
    // eslint-disable-next-line no-unused-vars
    contributors = 'Contributors',
    // eslint-disable-next-line no-unused-vars
    collaborators = 'Other Contributors',
    // eslint-disable-next-line no-unused-vars
    iso_639_3 = 'ISO 639-3',
    // eslint-disable-next-line no-unused-vars
    glottocode = 'Glottocode',
    // eslint-disable-next-line no-unused-vars
    coordinates = 'Coordinates',
    // eslint-disable-next-line no-unused-vars
    location = 'Location',
    // eslint-disable-next-line no-unused-vars
    gloss_languages = 'Gloss Languages',
    // eslint-disable-next-line no-unused-vars
    alternate_names = 'Alternate Names',
    // eslint-disable-next-line no-unused-vars
    orthographies = 'Alternate Orthographies',
    // eslint-disable-next-line no-unused-vars
    created_at = 'Created At',
    // eslint-disable-next-line no-unused-vars
    language_used_by_community = 'Language Used by Community',
    // eslint-disable-next-line no-unused-vars
    community_permission = 'Community Permission',
    // eslint-disable-next-line no-unused-vars
    author_connection = 'Author Connection',
    // eslint-disable-next-line no-unused-vars
    con_language_description = 'Conlang Description',
    // eslint-disable-next-line no-unused-vars
    conlang = 'Conlang',
  }

  type SortFields = keyof typeof DictionaryFields
  // @ts-ignore
  const userFields: {
    key: SortFields
    value: DictionaryFields
  }[] = Object.entries(DictionaryFields).map(([key, value]) => {
    return { key, value }
  })

  let sortKey: SortFields = 'name'
  let sortDescending = true

  $: sortedDictionaries = dictionaries.sort((a, b) => {
    let valueA: string | number
    let valueB: string | number
    // prettier-ignore
    switch (sortKey) {
      case 'public':
        valueA = a.public?.toString() || ''
        valueB = b.public?.toString() || ''
        break
      case 'language_used_by_community': // should add a test and try to combine these first two cases with the default case, boolean and strings should be able to be handled in one case
        valueA = a.public?.toString() || ''
        valueB = b.public?.toString() || ''
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
        valueA = a.created_at || 0
        valueB = b.created_at || 0
        break
      case 'conlang':
        valueA = a.con_language_description?.toString() || ''
        valueB = b.con_language_description?.toString() || ''
        break
      default:
        valueA = a[sortKey] ? a[sortKey].toUpperCase() : 'zz' // if we ever have missing names or email, then pass 'zz' when the sortKey is undefined
        valueB = b[sortKey] ? b[sortKey].toUpperCase() : 'zz'
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
  {#each userFields as field}
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
