<script lang="ts">
  import { BadgeArrayEmit, Button, ShowHide } from 'svelte-pieces'
  import { updateOnline } from 'sveltefirets'
  import type { TablesUpdate } from '@living-dictionaries/types'
  import DictionaryFieldEdit from './DictionaryFieldEdit.svelte'
  import RolesManagment from './RolesManagment.svelte'
  import type { DictionaryWithHelperStores } from './dictionaryWithHelpers'
  import ContributorInvitationStatus from '$lib/components/contributors/ContributorInvitationStatus.svelte'
  import { supabase_date_to_friendly } from '$lib/helpers/time'
  import LatLngDisplay from '$lib/components/maps/LatLngDisplay.svelte'
  import { page } from '$app/stores'

  export let index: number
  export let dictionary: DictionaryWithHelperStores
  export let update_dictionary: (change: TablesUpdate<'dictionaries'> & { id: string }) => Promise<void>

  const { managers, contributors, writeInCollaborators, invites } = dictionary
  $: ({ admin } = $page.data)
</script>

<td class="relative">
  <span on:click={() => window.open(`/${dictionary.id}`)} class="absolute top-0 left-0 text-xs text-gray-400 cursor-pointer">{index + 1}</span>
  <DictionaryFieldEdit field="name" value={dictionary.name} dictionary_id={dictionary.id} {update_dictionary} />
</td>
<td>
  <Button
    color={dictionary.public ? 'green' : 'orange'}
    size="sm"
    onclick={async () => {
      if (confirm('Flip this dictionary\'s visibility?')) {
        await update_dictionary({
          id: dictionary.id,
          public: !dictionary.public,
        })
      }
    }}>
    {dictionary.public ? 'Public' : 'Private'}
  </Button>
</td>
<td>
  <Button title="View Entries" size="sm" form="simple" href="/{dictionary.id}">
    {dictionary.entry_count}
    <!-- <span class="i-tabler-external-link" style="vertical-align: -1px;" /> -->
  </Button>
</td>
<td>
  <div style="width: 300px;" />
  <RolesManagment helpers={$managers} {dictionary} role="manager" />
  {#each $invites || [] as invite}
    {#if invite.role === 'manager'}
      <div class="my-1">
        <ContributorInvitationStatus
          admin
          {invite}
          on_delete_invite={() =>
            updateOnline(`dictionaries/${dictionary.id}/invites/${invite.id}`, {
              status: 'cancelled',
            })}>
          <span class="i-mdi-email-send" slot="prefix" />
        </ContributorInvitationStatus>
      </div>
    {/if}
  {/each}
</td>
<td>
  <div style="width: 300px;" />
  <RolesManagment helpers={$contributors} {dictionary} role="contributor" />
  {#each $invites || [] as invite}
    {#if invite.role === 'contributor'}
      <div class="my-1">
        <ContributorInvitationStatus
          admin
          {invite}
          on_delete_invite={() =>
            updateOnline(`dictionaries/${dictionary.id}/invites/${invite.id}`, {
              status: 'cancelled',
            })}>
          <span class="i-mdi-email-send" slot="prefix" />
        </ContributorInvitationStatus>
      </div>
    {/if}
  {/each}
</td>
<td>
  <div style="width: 300px;" />
  <RolesManagment helpers={$writeInCollaborators} {dictionary} role="writeInCollaborator" />
</td>
<td>
  <DictionaryFieldEdit
    field="iso_639_3"
    value={dictionary.iso_639_3}
    dictionary_id={dictionary.id}
    {update_dictionary} />
</td>
<td>
  <DictionaryFieldEdit
    field="glottocode"
    value={dictionary.glottocode}
    dictionary_id={dictionary.id}
    {update_dictionary} />
</td>
<td>
  <ShowHide let:show let:toggle>
    <Button size="sm" form="simple" onclick={toggle}>
      {#if dictionary.coordinates?.points?.length}
        <LatLngDisplay
          lat={dictionary.coordinates.points[0].coordinates.latitude}
          lng={dictionary.coordinates.points[0].coordinates.longitude} />
      {:else}<b>Add</b>{/if}
    </Button>
    {#if show}
      {#await import('$lib/components/maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
        <CoordinatesModal
          lat={dictionary.coordinates?.points?.length ? dictionary.coordinates.points[0].coordinates.latitude : undefined}
          lng={dictionary.coordinates?.points?.length ? dictionary.coordinates.points[0].coordinates.longitude : undefined}
          on:update={({ detail: { lat, lng } }) => {
            const [, ...rest] = dictionary.coordinates?.points || []
            update_dictionary({
              id: dictionary.id,
              coordinates: {
                points: [{ coordinates: { latitude: lat, longitude: lng } }, ...rest],
                regions: dictionary.coordinates?.regions,
              },
            })
          }}
          on:remove={() => {
            const [, ...rest] = dictionary.coordinates?.points || []
            update_dictionary({
              id: dictionary.id,
              coordinates: {
                points: rest,
                regions: dictionary.coordinates?.regions,
              },
            })
          }}
          on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
</td>
<td>
  <DictionaryFieldEdit
    field="location"
    value={dictionary.location}
    dictionary_id={dictionary.id}
    {update_dictionary} />
</td>
<td>
  <BadgeArrayEmit addMessage="Add" strings={dictionary.gloss_languages} />
</td>
<td>
  <div style="width: 300px;" />
  <BadgeArrayEmit
    canEdit
    addMessage="Add"
    strings={dictionary.alternate_names}
    on:additem={() => {
      const name = prompt('Enter alternate name:')
      if (name) {
        update_dictionary({
          id: dictionary.id,
          alternate_names: [...(dictionary.alternate_names || []), name],
        })
      }
    }}
    on:itemremoved={({ detail: { value } }) => {
      update_dictionary({
        id: dictionary.id,
        alternate_names: dictionary.alternate_names.filter(name => name !== value),
      })
    }} />
</td>
<td>
  {dictionary.orthographies?.length? dictionary.orthographies.map(({ name }) => name.default) : ''}
</td>
<td class="whitespace-nowrap">
  {#if dictionary.created_at}{supabase_date_to_friendly(dictionary.created_at)}{/if}
</td>
<td>{dictionary.language_used_by_community !== undefined
  ? dictionary.language_used_by_community
  : ''}</td>
<td>{dictionary.community_permission ? dictionary.community_permission : ''}</td>

<td><div style="width: 300px;" />
  {dictionary.author_connection ? dictionary.author_connection : ''}</td>
<td>
  <div style="width: 300px;" />
  {dictionary.con_language_description ? dictionary.con_language_description : ''}</td>
<td>
  <Button
    color={dictionary.con_language_description ? 'green' : 'orange'}
    size="sm"
    onclick={() => {
      if (confirm('Toggle con lang status?')) {
        update_dictionary({
          id: dictionary.id,
          con_language_description: !dictionary.con_language_description ? 'YES' : null,
        })
      }
    }}>
    {dictionary.con_language_description ? 'YES' : 'NO'}
  </Button>
</td>
{#if $admin > 1}
  <td class="cursor-pointer" title={JSON.stringify(dictionary, null, 1)}><span class="i-material-symbols-info-outline" /></td>
{/if}
