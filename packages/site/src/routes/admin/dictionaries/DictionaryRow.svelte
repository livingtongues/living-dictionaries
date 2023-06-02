<script lang="ts">
  import { admin } from '$lib/stores';
  import { printDate } from '$lib/helpers/time';
  import DictionaryFieldEdit from './DictionaryFieldEdit.svelte';
  import { BadgeArrayEmit, ShowHide, Button, IntersectionObserverShared } from 'svelte-pieces';
  import { createEventDispatcher } from 'svelte';
  import { updateOnline } from 'sveltefirets';
  import { LatLngDisplay } from '@living-dictionaries/parts';
  import ContributorInvitationStatus from '$lib/components/contributors/ContributorInvitationStatus.svelte';
  import RolesManagment from './RolesManagment.svelte';
  import type { DictionaryWithHelperStores } from './dictionaryWithHelpers';

  export let dictionary: DictionaryWithHelperStores;
  const { managers, contributors, writeInCollaborators, invites } = dictionary;

  const dispatch = createEventDispatcher<{
    addalternatename: string;
    removealternatename: string;
    toggleprivacy: boolean;
    togglevideoaccess: boolean;
    updatecoordinates: { lat: number; lng: number };
    removecoordinates: boolean;
  }>();
</script>

<tr>
  <td class="italic">
    <DictionaryFieldEdit field={'name'} value={dictionary.name} dictionaryId={dictionary.id} />
  </td>
  <td>
    <Button
      color={dictionary.public ? 'green' : 'orange'}
      size="sm"
      onclick={() => {
        if (confirm("Flip this dictionary's visibility?")) {
          dispatch('toggleprivacy');
        }
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
    {#each $invites as invite}
      {#if invite.role === 'manager'}
        <div class="my-1">
          <ContributorInvitationStatus
            admin
            {invite}
            on:delete={() =>
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
    {#each $invites as invite}
      {#if invite.role === 'contributor'}
        <div class="my-1">
          <ContributorInvitationStatus
            admin
            {invite}
            on:delete={() =>
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
      field={'iso6393'}
      value={dictionary.iso6393}
      dictionaryId={dictionary.id} />
  </td>
  <td>
    <DictionaryFieldEdit
      field={'glottocode'}
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
        {#await import('@living-dictionaries/parts/src/lib/maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
          <CoordinatesModal
            lng={dictionary.coordinates ? dictionary.coordinates.longitude : undefined}
            lat={dictionary.coordinates ? dictionary.coordinates.latitude : undefined}
            on:update={({ detail: { lat, lng } }) => {
              dispatch('updatecoordinates', { lat, lng });
            }}
            on:remove={() => dispatch('removecoordinates')}
            on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  </td>
  <td>
    <DictionaryFieldEdit
      field={'location'}
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
      addMessage={'Add'}
      strings={dictionary.alternateNames}
      on:additem={() => {
        const name = prompt('Enter alternate name:');
        if (name) {
          dispatch('addalternatename', name);
        }
      }}
      on:itemremoved={(e) => dispatch('removealternatename', e.detail.value)} />
  </td>
  <td>
    {dictionary.alternateOrthographies || ''}
  </td>
  <td class="whitespace-nowrap">
    {#if dictionary.createdAt}{printDate(dictionary.createdAt.toDate())}{/if}
  </td>
  <td>
    <Button
      color={dictionary.videoAccess ? 'green' : 'orange'}
      size="sm"
      onclick={() => {
        dispatch('togglevideoaccess');
      }}>
      {dictionary.videoAccess ? 'Can Record' : 'Give Access'}
    </Button>
  </td>
  <td
    >{dictionary.languageUsedByCommunity !== undefined
      ? dictionary.languageUsedByCommunity
      : ''}</td>
  <td>{dictionary.communityPermission ? dictionary.communityPermission : ''}</td>

  <td
    ><div style="width: 300px;" />
    {dictionary.authorConnection ? dictionary.authorConnection : ''}</td>
  <td>
    <div style="width: 300px;" />
    {dictionary.conLangDescription ? dictionary.conLangDescription : ''}</td>
  {#if $admin > 1}
    <td class="cursor-pointer" title={JSON.stringify(dictionary, null, 1)}
      ><span class="i-material-symbols-info-outline" /></td>
  {/if}
</tr>
