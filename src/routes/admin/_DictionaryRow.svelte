<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { admin } from '$lib/stores';
  import type { IDictionary, IHelper, IInvite } from '$lib/interfaces';
  import { printDate } from '$lib/helpers/time';
  export let dictionary: IDictionary;
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import DictionaryFieldEdit from './_DictionaryFieldEdit.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import BadgeArrayEmit from '$svelteui/data/BadgeArrayEmit.svelte';
  import { createEventDispatcher } from 'svelte';
  import { Collection, updateOnline } from '$sveltefirets';
  import { where } from 'firebase/firestore';
  import RolesManagment from './_RolesManagment.svelte';
  import IntersectionObserver from '$lib/components/ui/IntersectionObserver.svelte';

  const dispatch = createEventDispatcher<{
    addalternatename: string;
    removealternatename: string;
    toggleprivacy: boolean;
    togglevideoaccess: boolean;
  }>();

  let helperType: IHelper[];
  let inviteType: IInvite[];
</script>

<tr title={$admin > 1 && JSON.stringify(dictionary, null, 1)}>
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
  <td class="italic">
    <DictionaryFieldEdit field={'name'} value={dictionary.name} dictionaryId={dictionary.id} />
  </td>
  <td>
    {dictionary.entryCount || ''}
  </td>
  <td>
    <IntersectionObserver let:intersecting once>
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
          <div class="py-3 flex flex-wrap items-center justify-between">
            <div class="text-sm leading-5 font-medium text-gray-900">
              <i
                >{$_('contributors.invitation_sent', {
                  default: 'Invitation sent',
                })}:</i>
            </div>
            {#each invites as invite}
              {invite.targetEmail}
              <Button
                color="red"
                size="sm"
                onclick={() => {
                  if (confirm($_('misc.delete', { default: 'Delete' }))) {
                    updateOnline(`dictionaries/${dictionary.id}/invites/${invite.id}`, {
                      status: 'cancelled',
                    });
                  }
                }}
                >{$_('misc.delete', { default: 'Delete' })}
                <i class="fas fa-times" /><i class="fas fa-key mx-1" /></Button>
            {/each}
          </div>
        </Collection>
      {/if}
    </IntersectionObserver>
  </td>
  <td>
    <IntersectionObserver let:intersecting once>
      {#if intersecting}
        <Collection
          path={`dictionaries/${dictionary.id}/contributors`}
          startWith={helperType}
          let:data={contributors}>
          <RolesManagment helpers={contributors} {dictionary} role="contributor" />
        </Collection>
      {/if}
    </IntersectionObserver>
  </td>
  <td>
    <IntersectionObserver let:intersecting once>
      {#if intersecting}
        <Collection
          path={`dictionaries/${dictionary.id}/writeInCollaborators`}
          startWith={helperType}
          let:data={writeInCollaborators}>
          <RolesManagment helpers={writeInCollaborators} {dictionary} role="writeInCollaborator" />
        </Collection>
      {/if}
    </IntersectionObserver>
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
          {dictionary.coordinates.latitude}°
          {dictionary.coordinates.latitude < 0 ? 'S' : 'N'},
          {dictionary.coordinates.longitude}°
          {dictionary.coordinates.longitude < 0 ? 'W' : 'E'}
        {:else}<b>Add</b>{/if}
      </Button>
      {#if show}
        {#await import('$lib/components/modals/Coordinates.svelte') then { default: Coordinates }}
          <Coordinates on:close={toggle} {dictionary} on:save on:remove />
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
</tr>
