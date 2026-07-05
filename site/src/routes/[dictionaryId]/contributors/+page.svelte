<script lang="ts">
  import IconMdiEmailOutline from '~icons/mdi/email-outline'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiPencilOutline from '~icons/mdi/pencil-outline'
  import CitationComponent from './Citation.svelte'
  import Partners from './Partners.svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import ContributorInvitationStatus from '$lib/components/contributors/ContributorInvitationStatus.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Skeleton from '$lib/components/ui/Skeleton.svelte'
  import { stream_resolve } from '$lib/state/stream-resolve.svelte'
  import { page } from '$app/state'

  const { data } = $props()
  const { dictionary, is_manager, is_contributor, auth_user, editor_edits } = $derived(data)

  // Resolved on SSR/hydration; a pending streamed promise on client-nav. STICKY
  // across the invalidate('contributors:reload') after each edit, so the lists
  // never flash back to skeletons mid-session.
  const contributors_data = stream_resolve(() => data.contributors_data)
  const managers = $derived(contributors_data.value?.managers ?? [])
  const contributors = $derived(contributors_data.value?.contributors ?? [])
  const invites = $derived(contributors_data.value?.invites ?? [])
  const partners = $derived(contributors_data.value?.partners ?? [])
  const lists_pending = $derived(contributors_data.value === undefined)

  const manager_invites = $derived(invites.filter(invite => invite.role === 'manager'))
  const contributor_invites = $derived(invites.filter(invite => invite.role === 'contributor'))
  const write_in_collaborators = $derived(dictionary.write_in_collaborators ?? [])
</script>

{#snippet person_skeleton_rows()}
  {#each [0, 1] as index (index)}
    <div class="person-row">
      <Skeleton width="{9 + index * 3}rem" height="0.875rem" />
    </div>
  {/each}
{/snippet}

<p class="intro">
  <i>{page.data.t('contributors.manager_contributor_distinction')}</i>
</p>

<h3 class="section-heading">
  {page.data.t('contributors.managers')}
</h3>

<div class="person-list">
  {#if lists_pending}
    {@render person_skeleton_rows()}
  {/if}
  {#each managers as manager (manager.user_id)}
    <div class="person-row">
      <div class="person-name">
        {#if manager.full_name}
          {manager.full_name}
        {:else}
          Anonymous
        {/if}
      </div>
    </div>
  {/each}
  {#if is_manager}
    {#each manager_invites as invite (invite.id)}
      <div style="margin-top: 0.25rem; margin-bottom: 0.25rem">
        <ContributorInvitationStatus
          admin={auth_user.admin_level > 0}
          {invite}
          on_delete_invite={editor_edits.cancelInvite(invite.id)}>
          {#snippet prefix()}
            <i>{page.data.t('contributors.invitation_sent')}:</i>
          {/snippet}
        </ContributorInvitationStatus>
      </div>
    {/each}
  {/if}
</div>
{#if is_manager}
  <HeadlessButton onclick={editor_edits.inviteHelper('manager')} class="btn-primary btn-default" style="gap: 0.4rem">
    <IconMdiEmailOutline />
    {page.data.t('contributors.invite_manager')}
  </HeadlessButton>
{/if}

<h3 class="section-heading">
  {page.data.t('dictionary.contributors')}
</h3>
<div class="person-list">
  {#if lists_pending}
    {@render person_skeleton_rows()}
  {/if}
  {#each contributors as contributor (contributor.user_id)}
    <div class="person-row">
      <div class="person-name">
        {#if contributor.full_name}
          {contributor.full_name}
        {:else}
          Anonymous
        {/if}
      </div>
      {#if is_manager}
        <div style="flex-grow: 1"></div>
        <HeadlessButton
          onclick={editor_edits.removeContributor(contributor.id)}
          class="btn-ghost btn-sm delete-button"
          style="gap: 0.25rem">
          {page.data.t('misc.delete')}
          <IconMdiClose />
        </HeadlessButton>
      {/if}
    </div>
  {/each}
  {#if is_manager}
    {#each contributor_invites as invite (invite.id)}
      <div style="margin-top: 0.25rem; margin-bottom: 0.25rem">
        <ContributorInvitationStatus
          admin={auth_user.admin_level > 0}
          {invite}
          on_delete_invite={editor_edits.cancelInvite(invite.id)}>
          {#snippet prefix()}
            <i>{page.data.t('contributors.invitation_sent')}:</i>
          {/snippet}
        </ContributorInvitationStatus>
      </div>
    {/each}
    <HeadlessButton onclick={editor_edits.inviteHelper('contributor')} class="btn-primary btn-default" style="gap: 0.4rem">
      <IconMdiEmailOutline />
      {page.data.t('contributors.invite_contributors')}
    </HeadlessButton>
  {:else if !is_contributor}
    <ShowHide>
      {#snippet children({ show, toggle })}
        <button type="button" class="btn-primary btn-default" onclick={toggle}>
          {page.data.t('contributors.request_access')}
        </button>
        {#if show}
          {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
            <Contact subject="request_access" on_close={toggle} />
          {/await}
        {/if}
      {/snippet}
    </ShowHide>
  {/if}
</div>

<h3 class="section-heading">
  {page.data.t('contributors.other_contributors')}
</h3>
<div class="person-list">
  {#each write_in_collaborators as collaborator (collaborator)}
    <div class="person-row">
      <div class="person-name">
        {collaborator}
      </div>
      {#if is_manager}
        <div style="flex-grow: 1"></div>
        <HeadlessButton
          class="btn-ghost btn-sm delete-button"
          style="gap: 0.25rem"
          onclick={editor_edits.removeWriteInCollaborator(write_in_collaborators, collaborator)}>{page.data.t('misc.delete')}
          <IconMdiClose /></HeadlessButton>
      {/if}
    </div>
  {/each}
</div>

{#if is_manager}
  <HeadlessButton onclick={async () => await editor_edits.writeInCollaborator(write_in_collaborators)} class="btn-primary btn-default" style="gap: 0.4rem">
    <IconMdiPencilOutline />
    {page.data.t('contributors.write_in_contributor')}
  </HeadlessButton>
{/if}

{#if !dictionary.con_language_description}
  <hr class="section-divider" />
  <Partners {partners} can_edit={is_manager} hideLivingTonguesLogo={!!dictionary.hide_living_tongues_logo} admin={auth_user.admin_level >= 2 ? auth_user.admin_level : 0} {...data.partner_edits} />

  <!-- Not using contributors.request_to_add_manager -->

  <hr class="section-divider" />

  {#if dictionary.id !== 'onondaga'}
    <h3 class="team-heading">
      {page.data.t('contributors.LD_team')}
    </h3>
    <div style="margin-bottom: 1rem">
      Gregory D. S. Anderson -
      <span class="role-note">
        {page.data.t('contributors.LD_founder')}
      </span>
      <br />
      K. David Harrison -
      <span class="role-note">
        {page.data.t('contributors.LD_founder')}
      </span>
      <br />
      Anna Luisa Daigneault -
      <span class="role-note">
        {page.data.t('contributors.coordinator_editor')}
      </span>
      <br />
      Jacob Bowdoin -
      <span class="role-note">
        {page.data.t('contributors.developer_designer')}
      </span>
      <br />
      Diego Córdova Nieto -
      <span class="role-note">
        {page.data.t('contributors.developer_designer')}
      </span>
      <br />
    </div>
  {/if}

  <hr class="section-divider" />
  <p class="rights-note">
    {page.data.t('contributors.all_rights_reserved_permission')}
  </p>

  <h3 class="cite-heading">
    {page.data.t('contributors.how_to_cite_academics')}
  </h3>

  <CitationComponent isManager={is_manager} {dictionary} {partners} citation={dictionary.citation} update_citation={data.update_citation} />

  <div style="margin-bottom: 3rem"></div>
{/if}

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('dictionary.contributors')}
  dictionaryName={dictionary.name}
  description="Learn about the people who are building and managing this Living Dictionary."
  keywords="Contributors, Managers, Writers, Editors, Dictionary builders, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary, Print a dictionary" />

<style>
  .intro {
    margin-bottom: 0.5rem;
    color: var(--color-secondary);
  }

  .section-heading {
    font-weight: 600;
    font-size: 1.125rem;
    line-height: 1.75rem;
    margin-bottom: 0.25rem;
    margin-top: 2rem;
  }

  .person-list > :global(:not([hidden]) ~ :not([hidden])) {
    border-top: 1px solid var(--border-color);
  }

  .person-name {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: var(--color);
  }

  .person-row {
    padding-top: 0.625rem;
    padding-bottom: 0.625rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  :global(.delete-button) {
    color: var(--danger);
  }

  .section-divider {
    margin: 2rem 0;
    border: none;
    border-top: 1px solid var(--border-color);
  }

  .team-heading {
    font-weight: 600;
    margin-bottom: 0.5rem;
    margin-top: 2rem;
  }

  .role-note {
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color-secondary);
  }

  .rights-note {
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color-secondary);
  }

  .cite-heading {
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
</style>
