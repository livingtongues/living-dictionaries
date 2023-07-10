<script lang="ts">
  import { t } from 'svelte-i18n';
  import { add, deleteDocumentOnline, updateOnline, Collection } from 'sveltefirets';
  import { where } from 'firebase/firestore';
  import { isManager, isContributor, dictionary, admin } from '$lib/stores';
  import type { IInvite, IHelper } from '@living-dictionaries/types';
  import { Button, ShowHide } from 'svelte-pieces';
  import { inviteHelper } from '$lib/helpers/inviteHelper';
  import { removeDictionaryContributor } from '$lib/helpers/dictionariesManaging';
  import ContributorInvitationStatus from '$lib/components/contributors/ContributorInvitationStatus.svelte';
  import Citation from './Citation.svelte';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { findSubject } from '$lib/helpers/contact/findSubject';

  let helperType: IHelper[];
  let inviteType: IInvite[];

  function writeIn() {
    const name = prompt(`${$t('speakers.name', { default: 'Name' })}?`);
    if (name)
      add(`dictionaries/${$dictionary.id}/writeInCollaborators`, { name });

  }
</script>

<p class="mb-2">
  <i
  >{$t('contributors.manager_contributor_distinction', {
    default:
      'Note: Dictionary managers may add, edit or delete content. Contributors are project collaborators who can also add and edit, but cannot delete any content.',
  })}</i>
</p>

<h3 class="font-semibold text-lg mb-1 mt-3">
  {$t('contributors.managers', { default: 'Managers' })}
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
          <ContributorInvitationStatus
            admin={$admin > 0}
            {invite}
            on:delete={() =>
              updateOnline(`dictionaries/${$dictionary.id}/invites/${invite.id}`, {
                status: 'cancelled',
              })}>
            <i slot="prefix"
            >{$t('contributors.invitation_sent', {
              default: 'Invitation sent',
            })}:</i>
          </ContributorInvitationStatus>
        </div>
      {/each}
    </Collection>
  {/if}
</div>
{#if $isManager}
  <Button onclick={() => inviteHelper('manager', $dictionary)} form="filled">
    <i class="far fa-envelope" />
    {$t('contributors.invite_manager', { default: 'Invite a Manager' })}
  </Button>
{/if}
<hr style="margin: 20px 0;" />
<h3 class="font-semibold text-lg mb-1 mt-3">
  {$t('dictionary.contributors', { default: 'Contributors' })}
</h3>
<div class="divide-y divide-gray-200">
  <Collection
    path={`dictionaries/${$dictionary.id}/contributors`}
    startWith={helperType}
    let:data={contributors}>
    {#each contributors as contributor}
      <div class="py-3 flex flex-wrap items-center">
        <div class="text-sm leading-5 font-medium text-gray-900">
          {contributor.name}
        </div>
        {#if $isManager}
          <div class="w-1" />
          <Button
            onclick={() => {
              if (confirm($t('misc.delete', { default: 'Delete' }) + '?'))
                removeDictionaryContributor(contributor, $dictionary.id);

            }}
            color="red"
            size="sm">
            {$t('misc.delete', { default: 'Delete' })}
            <i class="fas fa-times" />
          </Button>
        {/if}
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
          <ContributorInvitationStatus
            admin={$admin > 0}
            {invite}
            on:delete={() =>
              updateOnline(`dictionaries/${$dictionary.id}/invites/${invite.id}`, {
                status: 'cancelled',
              })}>
            <i slot="prefix"
            >{$t('contributors.invitation_sent', {
              default: 'Invitation sent',
            })}:</i>
          </ContributorInvitationStatus>
        </div>
      {/each}
    </Collection>
    <Button onclick={() => inviteHelper('contributor', $dictionary)} form="filled">
      <i class="far fa-envelope" />
      {$t('contributors.invite_contributors', {
        default: 'Invite Contributors',
      })}
    </Button>
  {:else if !$isContributor}
    <ShowHide let:show let:toggle>
      <!-- TODO call the Collection component to fecth all managers -->
      <Button onclick={toggle} form="filled">
        {$t('contributors.request_access', { default: 'Request Access' })}
      </Button>
      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact componentSubject={findSubject('request-access')} on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  {/if}
</div>
<hr style="margin: 20px 0;" />
<h3 class="font-semibold text-lg mb-1 mt-3">
  {$t('contributors.other_contributors', { default: 'Other Contributors' })}
</h3>
<div class="divide-y divide-gray-200">
  <Collection
    path={`dictionaries/${$dictionary.id}/writeInCollaborators`}
    startWith={helperType}
    let:data={writeInCollaborators}>
    {#each writeInCollaborators as collaborator}
      <div class="py-3 flex flex-wrap items-center">
        <div class="text-sm leading-5 font-medium text-gray-900">
          {collaborator.name}
        </div>
        {#if $isManager}
          <div class="w-1" />
          <Button
            color="red"
            size="sm"
            onclick={() => {
              if (confirm($t('misc.delete', { default: 'Delete' }) + '?')) {
                deleteDocumentOnline(
                  `dictionaries/${$dictionary.id}/writeInCollaborators/${collaborator.id}`
                );
              }
            }}
          >{$t('misc.delete', { default: 'Delete' })}
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
    {$t('contributors.write_in_contributor', {
      default: 'Write in Contributor',
    })}
  </Button>
{/if}

<!-- Not using contributors.request_to_add_manager -->

<hr class="my-3" />

{#if $dictionary.id != 'onondaga'}
  <h3 class="font-semibold mb-1 mt-3">
    {$t('contributors.LD_team', { default: 'Living Dictionaries Team' })}
  </h3>
  <div class="mb-4">
    Gregory D. S. Anderson -
    <span class="text-sm">
      {$t('contributors.LD_founder', {
        default: 'Living Dictionary project founder',
      })}
    </span>
    <br />
    K. David Harrison -
    <span class="text-sm">
      {$t('contributors.LD_founder', {
        default: 'Living Dictionary project founder',
      })}
    </span>
    <br />
    Anna Luisa Daigneault -
    <span class="text-sm">
      {$t('contributors.coordinator_editor', {
        default: 'Project Coordinator and Content Editor',
      })}
    </span>
    <br />
    Jacob Bowdoin -
    <span class="text-sm">
      {$t('contributors.developer_designer', {
        default: 'Web Developer and Interface Designer',
      })}
    </span>
    <br />
    Diego Córdova Nieto -
    <span class="text-sm">
      {$t('contributors.developer_designer', {
        default: 'Web Developer and Interface Designer',
      })}
    </span>
    <br />
  </div>
{/if}

<hr class="my-3" />
<p class="mb-3 text-sm">
  {$t('contributors.all_rights_reserved_permission', {
    default: 'All rights reserved. Do not distribute or reproduce without permission.',
  })}
</p>

<h3 class="font-semibold">
  {$t('contributors.how_to_cite_academics', { default: 'How to Cite' })}
</h3>

<Citation isManager={$isManager} dictionary={$dictionary} />

<div class="mb-12" />

<SeoMetaTags
  title={$t('dictionary.contributors', { default: 'Contributors' })}
  dictionaryName={$dictionary.name}
  description={$t('', {
    default: 'Learn about the people who are building and managing this Living Dictionary.',
  })}
  keywords="Contributors, Managers, Writers, Editors, Dictionary builders, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary, Print a dictionary" />
