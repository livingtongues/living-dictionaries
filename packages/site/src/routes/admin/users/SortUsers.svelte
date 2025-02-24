<script lang="ts">
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'

  export let users: UserWithDictionaryRoles[] = []
  enum UserFields {
    email = 'Email',
    full_name = 'Name',
    dictionary_roles = 'Manager',
    contributor = 'Contributor',
    last_sign_in_at = 'Last Visit',
    created_at = 'Created At',
    unsubscribed_from_emails = 'Unsubscribed',
  }

  type SortFields = keyof typeof UserFields
  // @ts-ignore
  const userFields: {
    key: SortFields
    value: UserFields
  }[] = Object.entries(UserFields).map(([key, value]) => {
    return { key, value }
  })

  let sortKey: SortFields = 'email'
  let sortDescending = true
  $: keep_null_date_at_end = sortDescending ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER

  $: sortedUsers = users.sort((a, b) => {
    let valueA: string | number
    let valueB: string | number
    // prettier-ignore
    switch (sortKey) {
      case 'dictionary_roles':
        valueA = a.dictionary_roles?.length
        valueB = b.dictionary_roles?.length
        break
      case 'last_sign_in_at':
        valueA = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : keep_null_date_at_end
        valueB = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : keep_null_date_at_end
        break
      case 'created_at':
        valueA = a.created_at ? new Date(a.created_at).getTime() : keep_null_date_at_end
        valueB = b.created_at ? new Date(b.created_at).getTime() : keep_null_date_at_end
        break
      case 'unsubscribed_from_emails':
        valueA = a.unsubscribed_from_emails ? new Date(a.unsubscribed_from_emails).getTime() : keep_null_date_at_end
        valueB = b.unsubscribed_from_emails ? new Date(b.unsubscribed_from_emails).getTime() : keep_null_date_at_end
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

<slot {sortedUsers} />

<style>
  th {
    --at-apply: text-xs font-semibold text-gray-600 uppercase tracking-wider;
  }
</style>
