<script lang="ts">
  import { page } from '$app/stores';
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

  let helperType: IHelper[];
  let inviteType: IInvite[];

  function writeIn() {
    const name = prompt(`${$page.data.t('speakers.name')}?`);
    if (name)
      add(`dictionaries/${$dictionary.id}/writeInCollaborators`, { name });
  }
</script>

<p class="mb-2">
  <i>{$page.data.t('contributors.manager_contributor_distinction')}</i>
</p>

<h3 class="font-semibold text-lg mb-1 mt-3">
  {$page.data.t('contributors.managers')}
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
            <i slot="prefix">{$page.data.t('contributors.invitation_sent')}:</i>
          </ContributorInvitationStatus>
        </div>
      {/each}
    </Collection>
  {/if}
</div>
{#if $isManager}
  <Button onclick={() => inviteHelper('manager', $dictionary)} form="filled">
    <i class="far fa-envelope" />
    {$page.data.t('contributors.invite_manager')}
  </Button>
{/if}
<hr style="margin: 20px 0;" />
<h3 class="font-semibold text-lg mb-1 mt-3">
  {$page.data.t('dictionary.contributors')}
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
              if (confirm($page.data.t('misc.delete') + '?'))
                removeDictionaryContributor(contributor, $dictionary.id);
            }}
            color="red"
            size="sm">
            {$page.data.t('misc.delete')}
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
            <i slot="prefix">{$page.data.t('contributors.invitation_sent')}:</i>
          </ContributorInvitationStatus>
        </div>
      {/each}
    </Collection>
    <Button onclick={() => inviteHelper('contributor', $dictionary)} form="filled">
      <i class="far fa-envelope" />
      {$page.data.t('contributors.invite_contributors')}
    </Button>
  {:else if !$isContributor}
    <ShowHide let:show let:toggle>
      <Button onclick={toggle} form="filled">
        {$page.data.t('contributors.request_access')}
      </Button>
      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact subject="request_access" on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  {/if}
</div>
<hr style="margin: 20px 0;" />
<h3 class="font-semibold text-lg mb-1 mt-3">
  {$page.data.t('contributors.other_contributors')}
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
              if (confirm($page.data.t('misc.delete') + '?')) {
                deleteDocumentOnline(
                  `dictionaries/${$dictionary.id}/writeInCollaborators/${collaborator.id}`
                );
              }
            }}>{$page.data.t('misc.delete')}
            <i class="fas fa-times" /></Button>
        {/if}
      </div>
    {/each}
  </Collection>
</div>

<!-- <div class="text-gray-600 my-1 text-sm">
    {$page.data.t('dictionary.contributors')} = {$page.data.t(
      'contributors.speakers_other_collaborators',
      {
        default: 'speakers and any other collaborators',
      }
    )}
  </div> -->

{#if $isManager}
  <Button onclick={writeIn} form="filled">
    <i class="far fa-pencil" />
    {$page.data.t('contributors.write_in_contributor')}
  </Button>
{/if}

<!-- Not using contributors.request_to_add_manager -->

<hr class="my-3" />

{#if $dictionary.id != 'onondaga'}
  <h3 class="font-semibold mb-1 mt-3">
    {$page.data.t('contributors.LD_team')}
  </h3>
  <div class="mb-4">
    Gregory D. S. Anderson -
    <span class="text-sm">
      {$page.data.t('contributors.LD_founder')}
    </span>
    <br />
    K. David Harrison -
    <span class="text-sm">
      {$page.data.t('contributors.LD_founder')}
    </span>
    <br />
    Anna Luisa Daigneault -
    <span class="text-sm">
      {$page.data.t('contributors.coordinator_editor')}
    </span>
    <br />
    Jacob Bowdoin -
    <span class="text-sm">
      {$page.data.t('contributors.developer_designer')}
    </span>
    <br />
    Diego Córdova Nieto -
    <span class="text-sm">
      {$page.data.t('contributors.developer_designer')}
    </span>
    <br />
  </div>
{/if}

<hr class="my-3" />
<p class="mb-3 text-sm">
  {$page.data.t('contributors.all_rights_reserved_permission')}
</p>

<h3 class="font-semibold">
  {$page.data.t('contributors.how_to_cite_academics')}
</h3>

<Citation isManager={$isManager} dictionary={$dictionary} />

<div class="mb-12" />

<SeoMetaTags
  title={$page.data.t('dictionary.contributors')}
  dictionaryName={$dictionary.name}
  description="Learn about the people who are building and managing this Living Dictionary."
  keywords="Contributors, Managers, Writers, Editors, Dictionary builders, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary, Print a dictionary" />
