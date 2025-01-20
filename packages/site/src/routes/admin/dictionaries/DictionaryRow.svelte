<script lang="ts">
  import { BadgeArrayEmit, Button, ShowHide } from 'svelte-pieces'
  import { createEventDispatcher } from 'svelte'
  import { updateOnline } from 'sveltefirets'
  import DictionaryFieldEdit from './DictionaryFieldEdit.svelte'
  import RolesManagment from './RolesManagment.svelte'
  import type { DictionaryWithHelperStores } from './dictionaryWithHelpers'
  import ContributorInvitationStatus from '$lib/components/contributors/ContributorInvitationStatus.svelte'
  import { supabase_date_to_friendly } from '$lib/helpers/time'
  import LatLngDisplay from '$lib/components/maps/LatLngDisplay.svelte'
  import { page } from '$app/stores'

  export let index: number
  export let dictionary: DictionaryWithHelperStores
  const { managers, contributors, writeInCollaborators, invites } = dictionary
  $: ({ admin } = $page.data)

  const dispatch = createEventDispatcher<{
    addalternatename: string
    removealternatename: string
    toggleprivacy: boolean
    togglevideoaccess: boolean
    updatecoordinates: { lat: number, lng: number }
    removecoordinates: boolean
  }>()
</script>

<td class="relative">
  <span on:click={() => window.open(`/${dictionary.id}`)} class="absolute top-0 left-0 text-xs text-gray-400 cursor-pointer">{index + 1}</span>
  <DictionaryFieldEdit field="name" value={dictionary.name} dictionaryId={dictionary.id} />
</td>
<td>
  <Button
    color={dictionary.public ? 'green' : 'orange'}
    size="sm"
    onclick={() => {
      if (confirm('Flip this dictionary\'s visibility?'))
        dispatch('toggleprivacy')
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
    field="iso6393"
    value={dictionary.iso_639_3}
    dictionaryId={dictionary.id} />
</td>
<td>
  <DictionaryFieldEdit
    field="glottocode"
    value={dictionary.glottocode}
    dictionaryId={dictionary.id} />
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
            dispatch('updatecoordinates', { lat, lng })
          }}
          on:remove={() => dispatch('removecoordinates')}
          on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
</td>
<td>
  <DictionaryFieldEdit
    field="location"
    value={dictionary.location}
    dictionaryId={dictionary.id} />
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
      if (name)
        dispatch('addalternatename', name)
    }}
    on:itemremoved={e => dispatch('removealternatename', e.detail.value)} />
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
{#if $admin > 1}
  <td class="cursor-pointer" title={JSON.stringify(dictionary, null, 1)}><span class="i-material-symbols-info-outline" /></td>
{/if}
