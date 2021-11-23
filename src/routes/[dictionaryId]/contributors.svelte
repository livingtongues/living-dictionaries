<script context="module" lang="ts">
  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ page: { params } }) => {
    return {
      props: {
        dictionaryId: params.dictionaryId,
      },
    };
  };
</script>

<script lang="ts">
  export let dictionaryId: string;
  import { _ } from 'svelte-i18n';
  import { isManager, isContributor, dictionary, admin } from '$lib/stores';
  import Collection from '$sveltefire/components/Collection.svelte';
  import { where } from 'firebase/firestore';

  function invite(role: 'manager' | 'contributor' = 'contributor') {
    const input = prompt(`${$_('contact.email', { default: 'Email' })}?`);
    if (input) {
      const isEmail = /^\S+@\S+\.\S+$/.test(input);
      isEmail ? saveInvite(input, role) : alert($_('misc.invalid', { default: 'Invalid Email' }));
    }
  }

  import { add, deleteDocument, update } from '$sveltefire/firestorelite';
  import type { IInvite, IWriteInCollaborator, IContributor, IManager } from '$lib/interfaces';
  import Button from '$svelteui/ui/Button.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import { user } from '$sveltefire/user';

  let managerType: IManager[];
  let contributorType: IContributor[];
  let inviteType: IInvite[];
  let writeInCollaboratorType: IWriteInCollaborator[];

  async function saveInvite(targetEmail: string, role: 'manager' | 'contributor') {
    try {
      const invite: IInvite = {
        inviterEmail: $user.email,
        inviterName: $user.displayName,
        dictionaryName: $dictionary.name,
        targetEmail,
        role,
        status: 'queued',
      };
      await add(`dictionaries/${dictionaryId}/invites`, invite, true);
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
      console.error(err);
    }
  }

  function writeIn() {
    const name = prompt(`${$_('speakers.name', { default: 'Name' })}?`);
    if (name) {
      add(`dictionaries/${dictionaryId}/writeInCollaborators`, { name }, true);
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
  {$_('contributors.ld_produced_by', {
    default:
      'This Living Dictionary was produced at Living Tongues Institute for Endangered Languages under the direction of the following people.',
  })}
  <i
    >{$_('contributors.manager_contributor_distinction', {
      default:
        'Note: Dictionary managers may add, edit or delete content. Contributors are project collaborators who can also add and edit, but cannot delete any content.',
    })}</i
  >
</p>

<h3 class="font-semibold text-lg mb-1 mt-3">
  {$_('contributors.managers', { default: 'Managers' })}
</h3>

<div class="divide-y divide-gray-200">
  <Collection path={`dictionaries/${dictionaryId}/managers`} startWith={managerType} let:data>
    {#each data as manager}
      <div class="py-3">
        <div class="text-sm leading-5 font-medium text-gray-900">
          {manager.name}
        </div>
        <!-- <div class="text-sm leading-5 text-gray-500" /> -->
      </div>
    {/each}
  </Collection>
  {#if $isManager}
    <Collection
      path={`dictionaries/${dictionaryId}/invites`}
      queryConstraints={[where('role', '==', 'manager'), where('status', 'in', ['queued', 'sent'])]}
      startWith={inviteType}
      let:data
    >
      {#each data as invite}
        <div class="py-3 flex flex-wrap items-center justify-between">
          <div class="text-sm leading-5 font-medium text-gray-900">
            <i
              >{$_('contributors.invitation_sent', {
                default: 'Invitation sent',
              })}:</i
            >
            {invite.targetEmail}
          </div>
          {#if $admin}
            <Button
              color="red"
              size="sm"
              on:click={() => {
                if (confirm($_('misc.delete', { default: 'Delete' }))) {
                  update(`dictionaries/${dictionaryId}/invites/${invite.id}`, {
                    status: 'cancelled',
                  });
                }
              }}
              >{$_('misc.delete', { default: 'Delete' })}
              <i class="fas fa-times" /><i class="fas fa-key mx-1" /></Button
            >
          {/if}
        </div>
      {/each}
    </Collection>
  {/if}
</div>
{#if $isManager}
  <Button onclick={() => invite('manager')} form="primary">
    <i class="far fa-envelope" />
    {$_('contributors.invite_manager', { default: 'Invite a Manager' })}
  </Button>
{/if}

<h3 class="font-semibold text-lg mb-1 mt-3">
  {$_('dictionary.contributors', { default: 'Contributors' })}
</h3>

<div class="divide-y divide-gray-200">
  <Collection
    path={`dictionaries/${dictionaryId}/contributors`}
    startWith={contributorType}
    let:data
  >
    {#each data as contributor}
      <div class="py-3">
        <div class="text-sm leading-5 font-medium text-gray-900">
          {contributor.name}
        </div>
      </div>
    {/each}
  </Collection>
  {#if $isManager}
    <Collection
      path={`dictionaries/${dictionaryId}/invites`}
      queryConstraints={[
        where('role', '==', 'contributor'),
        where('status', 'in', ['queued', 'sent']),
      ]}
      startWith={inviteType}
      let:data
    >
      {#each data as invite}
        <div class="py-3 flex flex-wrap items-center justify-between">
          <div class="text-sm leading-5 font-medium text-gray-900">
            <i
              >{$_('contributors.invitation_sent', {
                default: 'Invitation sent',
              })}:</i
            >
            {invite.targetEmail}
          </div>
          {#if $admin}
            <Button
              color="red"
              size="sm"
              onclick={() => {
                if (confirm($_('misc.delete', { default: 'Delete' }))) {
                  update(`dictionaries/${dictionaryId}/invites/${invite.id}`, {
                    status: 'cancelled',
                  });
                }
              }}
              >{$_('misc.delete', { default: 'Delete' })}
              <i class="fas fa-times" /><i class="fas fa-key ml-1" /></Button
            >
          {/if}
        </div>
      {/each}
    </Collection>
  {/if}
  <Collection
    path={`dictionaries/${dictionaryId}/writeInCollaborators`}
    startWith={writeInCollaboratorType}
    let:data
  >
    {#each data as collaborator}
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
                deleteDocument(
                  `dictionaries/${dictionaryId}/writeInCollaborators/${collaborator.id}`
                );
              }
            }}
            >{$_('misc.delete', { default: 'Delete' })}
            <i class="fas fa-times" /></Button
          >
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
  <Button onclick={() => invite('contributor')} form="primary">
    <i class="far fa-envelope" />
    {$_('contributors.invite_contributors', {
      default: 'Invite Contributors',
    })}
  </Button>
  <Button onclick={writeIn} form="primary">
    <i class="far fa-pencil" />
    {$_('contributors.write_in_contributor', {
      default: 'Write in Contributor',
    })}
  </Button>
{:else if !$isContributor}
  <ShowHide let:show let:toggle>
    <Button onclick={toggle} form="primary">
      {$_('contributors.request_access', { default: 'Request Access' })}
    </Button>
    {#if show}
      {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
        <Contact on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}

<!-- Not using contributors.request_to_add_manager -->

<hr class="my-3" />

{#if dictionaryId != 'onondaga'}
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

<div class="mb-3" style="direction: ltr;">
  {new Date().getFullYear()}.
  {$dictionary.name}
  <span>{$_('misc.LD_singular', { default: 'Living Dictionary' })}.</span>
  Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/{$dictionary.id}
</div>
