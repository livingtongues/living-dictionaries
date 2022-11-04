<script lang="ts">
  import { admin } from '$lib/stores';
  import type { IDictionary, IHelper, IInvite } from '@living-dictionaries/types';
  import { printDate } from '$lib/helpers/time';
  export let dictionary: IDictionary;
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import DictionaryFieldEdit from './DictionaryFieldEdit.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import BadgeArrayEmit from 'svelte-pieces/data/BadgeArrayEmit.svelte';
  import { createEventDispatcher } from 'svelte';
  import { Collection, updateOnline } from 'sveltefirets';
  import { where } from 'firebase/firestore';
  import { Invitation, LatLngDisplay } from '@living-dictionaries/parts';

  import RolesManagment from './RolesManagment.svelte';
  import IntersectionObserverShared from 'svelte-pieces/functions/IntersectionObserverShared.svelte';

  const dispatch = createEventDispatcher<{
    addalternatename: string;
    removealternatename: string;
    toggleprivacy: boolean;
    togglevideoaccess: boolean;
    updatecoordinates: { lat: number; lng: number };
    removecoordinates: boolean;
  }>();

  let helperType: IHelper[];
  let inviteType: IInvite[];
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
    <Button href="/{dictionary.id}">
      {dictionary.entryCount || '?'}
    </Button>
  </td>
  <td>
    <div style="width: 300px;" />
    <IntersectionObserverShared bottom={2000} let:intersecting once>
      {#if intersecting}
        <Collection
          path={`dictionaries/${dictionary.id}/managers`}
          startWith={helperType}
          let:data={managers}>
          <RolesManagment helpers={managers} {dictionary} role="manager" />
        </Collection>
        <Collection
          path={`dictionaries/${dictionary.id}/invites`}
          queryConstraints={[
            where('role', '==', 'manager'),
            where('status', 'in', ['queued', 'sent']),
          ]}
          startWith={inviteType}
          let:data={invites}>
          {#each invites as invite}
            <div class="my-1">
              <Invitation
                admin
                {invite}
                on:delete={() =>
                  updateOnline(`dictionaries/${dictionary.id}/invites/${invite.id}`, {
                    status: 'cancelled',
                  })}>
                <span class="i-mdi-email-send" slot="prefix" />
              </Invitation>
            </div>
          {/each}
        </Collection>
      {/if}
    </IntersectionObserverShared>
  </td>
  <td>
    <div style="width: 300px;" />
    <IntersectionObserverShared bottom={2000} let:intersecting once>
      {#if intersecting}
        <Collection
          path={`dictionaries/${dictionary.id}/contributors`}
          startWith={helperType}
          let:data={contributors}>
          <RolesManagment helpers={contributors} {dictionary} role="contributor" />
        </Collection>
        <Collection
          path={`dictionaries/${dictionary.id}/invites`}
          queryConstraints={[
            where('role', '==', 'contributor'),
            where('status', 'in', ['queued', 'sent']),
          ]}
          startWith={inviteType}
          let:data={invites}>
          {#each invites as invite}
            <div class="my-1">
              <Invitation
                admin
                {invite}
                on:delete={() =>
                  updateOnline(`dictionaries/${dictionary.id}/invites/${invite.id}`, {
                    status: 'cancelled',
                  })}>
                <span class="i-mdi-email-send" slot="prefix" />
              </Invitation>
            </div>
          {/each}
        </Collection>
      {/if}
    </IntersectionObserverShared>
  </td>
  <td>
    <div style="width: 300px;" />
    <IntersectionObserverShared bottom={2000} let:intersecting once>
      {#if intersecting}
        <Collection
          path={`dictionaries/${dictionary.id}/writeInCollaborators`}
          startWith={helperType}
          let:data={writeInCollaborators}>
          <RolesManagment helpers={writeInCollaborators} {dictionary} role="writeInCollaborator" />
        </Collection>
      {/if}
    </IntersectionObserverShared>
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
  <td class="cursor-pointer" title={$admin > 1 && JSON.stringify(dictionary, null, 1)}>data</td>
</tr>
