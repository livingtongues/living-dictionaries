<script lang="ts">
  import type { Citation, IHelper, IInvite, Partner } from '@living-dictionaries/types'
  import { Button, ShowHide } from 'svelte-pieces'
  import CitationComponent from './Citation.svelte'
  import Partners from './Partners.svelte'
  import ContributorInvitationStatus from '$lib/components/contributors/ContributorInvitationStatus.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { page } from '$app/stores'

  export let data
  $: ({
    dictionary,
    is_manager,
    is_contributor,
    admin,
    editor_edits,
  } = data)

  let managers: IHelper[] = []
  $: data.managers_promise.then(_managers => managers = _managers)
  let contributors: IHelper[] = []
  $: data.contributors_promise.then(_contributors => contributors = _contributors)
  let writeInCollaborators: IHelper[] = []
  $: data.writeInCollaborators_promise.then(_writeInCollaborators => writeInCollaborators = _writeInCollaborators)
  let invites: IInvite[] = []
  $: data.invites_promise.then(_invites => invites = _invites)
  $: manager_invites = invites.filter(invite => invite.role === 'manager')
  $: contributor_invites = invites.filter(invite => invite.role === 'contributor')
  let partners: Partner[] = []
  $: data.partners_promise.then(_partners => partners = _partners)
  let citation: Citation
  $: data.citation_promise.then(_citation => citation = _citation)
</script>

<p class="mb-2">
  <i>{$page.data.t('contributors.manager_contributor_distinction')}</i>
</p>

<h3 class="font-semibold text-lg mb-1 mt-3">
  {$page.data.t('contributors.managers')}
</h3>

<div class="divide-y divide-gray-200">
  {#each managers as manager}
    <div class="py-3">
      <div class="text-sm leading-5 font-medium text-gray-900">
        {manager.name}
      </div>
    </div>
  {/each}
  {#if $is_manager}
    {#each manager_invites as invite}
      <div class="my-1">
        <ContributorInvitationStatus
          admin={$admin > 0}
          {invite}
          on_delete_invite={editor_edits.cancelInvite(invite.id)}>
          <i slot="prefix">{$page.data.t('contributors.invitation_sent')}:</i>
        </ContributorInvitationStatus>
      </div>
    {/each}
  {/if}
</div>
{#if $is_manager}
  <Button onclick={editor_edits.inviteHelper('manager', $dictionary)} form="filled">
    <i class="far fa-envelope" />
    {$page.data.t('contributors.invite_manager')}
  </Button>
{/if}

<hr class="my-4" />
<h3 class="font-semibold text-lg mb-1 mt-3">
  {$page.data.t('dictionary.contributors')}
</h3>
<div class="divide-y divide-gray-200">
  {#each contributors as contributor}
    <div class="py-3 flex flex-wrap items-center">
      <div class="text-sm leading-5 font-medium text-gray-900">
        {contributor.name}
      </div>
      {#if $is_manager}
        <div class="w-1" />
        <Button
          onclick={editor_edits.removeContributor(contributor.id)}
          color="red"
          size="sm">
          {$page.data.t('misc.delete')}
          <i class="fas fa-times" />
        </Button>
      {/if}
    </div>
  {/each}
  {#if $is_manager}
    {#each contributor_invites as invite}
      <div class="my-1">
        <ContributorInvitationStatus
          admin={$admin > 0}
          {invite}
          on_delete_invite={editor_edits.cancelInvite(invite.id)}>
          <i slot="prefix">{$page.data.t('contributors.invitation_sent')}:</i>
        </ContributorInvitationStatus>
      </div>
    {/each}
    <Button onclick={editor_edits.inviteHelper('contributor', $dictionary)} form="filled">
      <i class="far fa-envelope" />
      {$page.data.t('contributors.invite_contributors')}
    </Button>
  {:else if !$is_contributor}
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

<hr class="my-4" />
<h3 class="font-semibold text-lg mb-1 mt-3">
  {$page.data.t('contributors.other_contributors')}
</h3>
<div class="divide-y divide-gray-200">
  {#each writeInCollaborators as collaborator}
    <div class="py-3 flex flex-wrap items-center">
      <div class="text-sm leading-5 font-medium text-gray-900">
        {collaborator.name}
      </div>
      {#if $is_manager}
        <div class="w-1" />
        <Button
          color="red"
          size="sm"
          onclick={editor_edits.removeWriteInCollaborator(collaborator.id)}>{$page.data.t('misc.delete')}
          <i class="fas fa-times" /></Button>
      {/if}
    </div>
  {/each}
</div>

<!-- <div class="text-gray-600 mb-2 text-sm">
  ({$page.data.t('contributors.speakers_other_collaborators')})
</div> -->

{#if $is_manager}
  <Button onclick={editor_edits.writeInCollaborator} form="filled">
    <i class="far fa-pencil" />
    {$page.data.t('contributors.write_in_contributor')}
  </Button>
{/if}

<hr class="my-4" />
<Partners {partners} can_edit={$is_manager} hideLivingTonguesLogo={$dictionary.hideLivingTonguesLogo} admin={$admin} {...data.partner_edits} />

<!-- Not using contributors.request_to_add_manager -->

<hr class="my-4" />

{#if $dictionary.id !== 'onondaga'}
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

<CitationComponent isManager={$is_manager} dictionary={$dictionary} {partners} {citation} update_citation={data.update_citation} />

<div class="mb-12" />

<SeoMetaTags
  title={$page.data.t('dictionary.contributors')}
  dictionaryName={$dictionary.name}
  description="Learn about the people who are building and managing this Living Dictionary."
  keywords="Contributors, Managers, Writers, Editors, Dictionary builders, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary, Print a dictionary" />
