<script lang="ts">
  import type { IDictionary } from '@living-dictionaries/types';
  export let dictionaries: IDictionary[] = [];
  enum DictionaryFields {
    public = 'Public',
    name = 'Dictionary Name',
    entryCount = 'Entries',
    managers = 'Managers',
    contributors = 'Contributors',
    collaborators = 'Other Contributors',
    iso6393 = 'ISO 639-3',
    glottocode = 'Glottocode',
    coordinates = 'Coordinates',
    location = 'Location',
    glossLanguages = 'Gloss Languages',
    alternateNames = 'Alternate Names',
    alternateOrthographies = 'Alternate Orthographies',
    createdAt = 'Created At',
    videoAccess = 'Video Access',
  }

  type SortFields = keyof typeof DictionaryFields;
  //@ts-ignore
  const userFields: {
    key: SortFields;
    value: DictionaryFields;
  }[] = Object.entries(DictionaryFields).map(([key, value]) => {
    return { key, value };
  });

  let sortKey: SortFields = 'name';
  let sortDescending = true;

  $: sortedDictionaries = dictionaries.sort((a, b) => {
    let valueA: string | number;
    let valueB: string | number;
    // prettier-ignore
    switch (sortKey) {
      case 'public':
        valueA = a.public && a.public.toString() || '';
        valueB = b.public && b.public.toString() || '';
        break;
      case 'videoAccess':
        valueA = a.videoAccess && a.videoAccess.toString() || '';
        valueB = b.videoAccess && b.videoAccess.toString() || '';
        break;
      case 'entryCount':
        valueA = a.entryCount || 0;
        valueB = b.entryCount || 0;
        break;
      case 'coordinates':
        valueA = a.coordinates && a.coordinates.latitude || 0;
        valueB = b.coordinates && b.coordinates.latitude || 0;
        break;
      case 'glossLanguages':
        valueA = a.glossLanguages && a.glossLanguages.length || 0;
        valueB = b.glossLanguages && b.glossLanguages.length || 0;
        break;
      case 'alternateNames':
        valueA = a.alternateNames && a.alternateNames.length || 0;
        valueB = b.alternateNames && b.alternateNames.length || 0;
        break;
      case 'alternateOrthographies':
        valueA = a.alternateOrthographies && a.alternateOrthographies.length || 0;
        valueB = b.alternateOrthographies && b.alternateOrthographies.length || 0;
        break;
      case 'createdAt':
        valueA = a.createdAt && a.createdAt.seconds || 0;
        valueB = b.createdAt && b.createdAt.seconds || 0;
        break;
      default: 
        valueA = a[sortKey] ? a[sortKey].toUpperCase() : 'zz'; // if we ever have missing names or email, then pass 'zz' when the sortKey is undefined
        valueB = b[sortKey] ? b[sortKey].toUpperCase() : 'zz';
        // a[sortKey].localeCompare(b[sortKey])
    }
    if (valueA < valueB) {
      return sortDescending ? -1 : 1;
    }
    if (valueA > valueB) {
      return sortDescending ? 1 : -1;
    }
    return 0;
  });

  function setSortSettings(paraSortKey: SortFields) {
    //Changes the key if the sort wasn't based on the button before, and if it was, change the direction
    if (sortKey === paraSortKey) {
      sortDescending = !sortDescending;
    } else {
      sortKey = paraSortKey;
    }
  }
</script>

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

<slot {sortedDictionaries} />
