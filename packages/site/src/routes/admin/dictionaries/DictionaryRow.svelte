<script lang="ts">
  import { BadgeArrayEmit, Button, ShowHide } from 'svelte-pieces'
  import { createEventDispatcher } from 'svelte'
  import { updateOnline } from 'sveltefirets'
  import DictionaryFieldEdit from './DictionaryFieldEdit.svelte'
  import RolesManagment from './RolesManagment.svelte'
  import type { DictionaryWithHelperStores } from './dictionaryWithHelpers'
  import ContributorInvitationStatus from '$lib/components/contributors/ContributorInvitationStatus.svelte'
  import { printDate } from '$lib/helpers/time'
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
    {dictionary.entryCount}
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
    value={dictionary.iso6393}
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
      {#if dictionary.coordinates}
        <LatLngDisplay
          lat={dictionary.coordinates.latitude}
          lng={dictionary.coordinates.longitude} />
      {:else}<b>Add</b>{/if}
    </Button>
    {#if show}
      {#await import('$lib/components/maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
        <CoordinatesModal
          lng={dictionary.coordinates ? dictionary.coordinates.longitude : undefined}
          lat={dictionary.coordinates ? dictionary.coordinates.latitude : undefined}
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
  <BadgeArrayEmit addMessage="Add" strings={dictionary.glossLanguages} />
</td>
<td>
  <div style="width: 300px;" />
  <BadgeArrayEmit
    canEdit
    addMessage="Add"
    strings={dictionary.alternateNames}
    on:additem={() => {
      const name = prompt('Enter alternate name:')
      if (name)
        dispatch('addalternatename', name)
    }}
    on:itemremoved={e => dispatch('removealternatename', e.detail.value)} />
</td>
<td>
  {dictionary.alternateOrthographies || ''}
</td>
<td class="whitespace-nowrap">
  {#if dictionary.createdAt}{printDate(dictionary.createdAt.toDate())}{/if}
</td>
<td>{dictionary.languageUsedByCommunity !== undefined
  ? dictionary.languageUsedByCommunity
  : ''}</td>
<td>{dictionary.communityPermission ? dictionary.communityPermission : ''}</td>

<td><div style="width: 300px;" />
  {dictionary.authorConnection ? dictionary.authorConnection : ''}</td>
<td>
  <div style="width: 300px;" />
  {dictionary.conLangDescription ? dictionary.conLangDescription : ''}</td>
{#if $admin > 1}
  <td class="cursor-pointer" title={JSON.stringify(dictionary, null, 1)}><span class="i-material-symbols-info-outline" /></td>
{/if}
