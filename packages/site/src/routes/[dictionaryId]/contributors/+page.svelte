<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { add, deleteDocumentOnline, updateOnline, Collection } from 'sveltefirets';
  import { where } from 'firebase/firestore';
  import { isManager, isContributor, dictionary, admin } from '$lib/stores';
  import type { IInvite, IHelper } from '@living-dictionaries/types';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import { inviteHelper } from '$lib/helpers/inviteHelper';
  import { Invitation } from '@living-dictionaries/parts';
  import { setOnline } from 'sveltefirets';
  import type { ICitation } from '@living-dictionaries/types';

  import type { PageData } from './$types';
  export let data: PageData;
  let citation = data.citation || '';

  let helperType: IHelper[];
  let inviteType: IInvite[];

  $: citation ? citation.trim() : '';

  function writeIn() {
    const name = prompt(`${$_('speakers.name', { default: 'Name' })}?`);
    if (name) {
      add(`dictionaries/${$dictionary.id}/writeInCollaborators`, { name });
    }
  }

  async function save() {
    try {
      await setOnline<ICitation>(`dictionaries/${$dictionary.id}/info/citation`, { citation });
    } catch (err) {
      alert(err);
    }
  }
</script>

<svelte:head>
  <title>
    {$dictionary.name}
    {$_('dictionary.contributors', { default: 'Contributors' })}
  </title>
</svelte:head>

<p class="mb-2">
  <i
    >{$_('contributors.manager_contributor_distinction', {
      default:
        'Note: Dictionary managers may add, edit or delete content. Contributors are project collaborators who can also add and edit, but cannot delete any content.',
    })}</i>
</p>

<h3 class="font-semibold text-lg mb-1 mt-3">
  {$_('contributors.managers', { default: 'Managers' })}
</h3>

<div class="divide-y divide-gray-200">
  <Collection
    path={`dictionaries/${$dictionary.id}/managers`}
    startWith={helperType}
    let:data={managers}>
    {#each managers as manager}
      <div class="py-3">
        <div class="text-sm leading-5 font-medium text-gray-900">
          {manager.name}
        </div>
      </div>
    {/each}
  </Collection>
  {#if $isManager}
    <Collection
      path={`dictionaries/${$dictionary.id}/invites`}
      queryConstraints={[where('role', '==', 'manager'), where('status', 'in', ['queued', 'sent'])]}
      startWith={inviteType}
      let:data={invites}>
      {#each invites as invite}
        <div class="my-1">
          <Invitation
            admin={$admin}
            {invite}
            on:delete={() =>
              updateOnline(`dictionaries/${$dictionary.id}/invites/${invite.id}`, {
                status: 'cancelled',
              })}>
            <i slot="prefix"
              >{$_('contributors.invitation_sent', {
                default: 'Invitation sent',
              })}:</i>
          </Invitation>
        </div>
      {/each}
    </Collection>
  {/if}
</div>
{#if $isManager}
  <Button onclick={() => inviteHelper('manager', $dictionary)} form="filled">
    <i class="far fa-envelope" />
    {$_('contributors.invite_manager', { default: 'Invite a Manager' })}
  </Button>
{/if}
<hr style="margin: 20px 0;" />
<h3 class="font-semibold text-lg mb-1 mt-3">
  {$_('dictionary.contributors', { default: 'Contributors' })}
</h3>
<div class="divide-y divide-gray-200">
  <Collection
    path={`dictionaries/${$dictionary.id}/contributors`}
    startWith={helperType}
    let:data={contributors}>
    {#each contributors as contributor}
      <div class="py-3">
        <div class="text-sm leading-5 font-medium text-gray-900">
          {contributor.name}
        </div>
      </div>
    {/each}
  </Collection>
  {#if $isManager}
    <Collection
      path={`dictionaries/${$dictionary.id}/invites`}
      queryConstraints={[
        where('role', '==', 'contributor'),
        where('status', 'in', ['queued', 'sent']),
      ]}
      startWith={inviteType}
      let:data={invites}>
      {#each invites as invite}
        <div class="my-1">
          <Invitation
            admin={$admin}
            {invite}
            on:delete={() =>
              updateOnline(`dictionaries/${$dictionary.id}/invites/${invite.id}`, {
                status: 'cancelled',
              })}>
            <i slot="prefix"
              >{$_('contributors.invitation_sent', {
                default: 'Invitation sent',
              })}:</i>
          </Invitation>
        </div>
      {/each}
    </Collection>
    <Button onclick={() => inviteHelper('contributor', $dictionary)} form="filled">
      <i class="far fa-envelope" />
      {$_('contributors.invite_contributors', {
        default: 'Invite Contributors',
      })}
    </Button>
  {:else if !$isContributor}
    <ShowHide let:show let:toggle>
      <Button onclick={toggle} form="filled">
        {$_('contributors.request_access', { default: 'Request Access' })}
      </Button>
      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  {/if}
</div>
<hr style="margin: 20px 0;" />
<h3 class="font-semibold text-lg mb-1 mt-3">
  {$_('contributors.other_contributors', { default: 'Other Contributors' })}
</h3>
<div class="divide-y divide-gray-200">
  <Collection
    path={`dictionaries/${$dictionary.id}/writeInCollaborators`}
    startWith={helperType}
    let:data={writeInCollaborators}>
    {#each writeInCollaborators as collaborator}
      <div class="py-3 flex flex-wrap items-center justify-between">
        <div class="text-sm leading-5 font-medium text-gray-900">
          {collaborator.name}
        </div>
        {#if $isManager}
          <Button
            color="red"
            size="sm"
            onclick={() => {
              if (confirm($_('misc.delete', { default: 'Delete' }))) {
                deleteDocumentOnline(
                  `dictionaries/${$dictionary.id}/writeInCollaborators/${collaborator.id}`
                );
              }
            }}
            >{$_('misc.delete', { default: 'Delete' })}
            <i class="fas fa-times" /></Button>
        {/if}
      </div>
    {/each}
  </Collection>
</div>

<!-- <div class="text-gray-600 my-1 text-sm">
    {$_('dictionary.contributors', { default: 'Contributors' })} = {$_(
      'contributors.speakers_other_collaborators',
      {
        default: 'speakers and any other collaborators',
      }
    )}
  </div> -->

{#if $isManager}
  <Button onclick={writeIn} form="filled">
    <i class="far fa-pencil" />
    {$_('contributors.write_in_contributor', {
      default: 'Write in Contributor',
    })}
  </Button>
{/if}

<!-- Not using contributors.request_to_add_manager -->

<hr class="my-3" />

{#if $dictionary.id != 'onondaga'}
  <h3 class="font-semibold mb-1 mt-3">
    {$_('contributors.LD_team', { default: 'Living Dictionaries Team' })}
  </h3>
  <div class="mb-4">
    Gregory D. S. Anderson -
    <span class="text-sm">
      {$_('contributors.LD_founder', {
        default: 'Living Dictionary project founder',
      })}
    </span>
    <br />
    K. David Harrison -
    <span class="text-sm">
      {$_('contributors.LD_founder', {
        default: 'Living Dictionary project founder',
      })}
    </span>
    <br />
    Anna Luisa Daigneault -
    <span class="text-sm">
      {$_('contributors.coordinator_editor', {
        default: 'Project Coordinator and Content Editor',
      })}
    </span>
    <br />
    Jacob Bowdoin -
    <span class="text-sm">
      {$_('contributors.developer_designer', {
        default: 'Web Developer and Interface Designer',
      })}
    </span>
    <br />
    Diego Córdova Nieto -
    <span class="text-sm">
      {$_('contributors.developer_designer', {
        default: 'Web Developer and Interface Designer',
      })}
    </span>
    <br />
  </div>
{/if}

<hr class="my-3" />
<p class="mb-3 text-sm">
  {$_('contributors.all_rights_reserved_permission', {
    default: 'All rights reserved. Do not distribute or reproduce without permission.',
  })}
</p>

<h3 class="font-semibold">
  {$_('contributors.how_to_cite_academics', { default: 'How to Cite' })}
</h3>
{#if $isManager}
  <div>
    <!-- TODO add this text in i18n spreadsheet -->
    <p>In the field below, please add the authors of this dictionary. Their names will be added to the beginning of the citation.</p>
    <textarea
      name="conLangDescription"
      rows="3"
      bind:value={citation}
      class="form-input w-full"
    />
    <Button class="mb-2" form="filled" size="sm" onclick={save}>
      {$_('misc.save', { default: 'Save' })}
    </Button>
  </div>
{/if}

<div class="mb-12" style="direction: ltr;">
  {citation ? citation + ' ' : ''}
  {new Date().getFullYear()}.
  {$dictionary.name}
  <span>{$_('misc.LD_singular', { default: 'Living Dictionary' })}.</span>
  Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/{$dictionary.id}
</div>