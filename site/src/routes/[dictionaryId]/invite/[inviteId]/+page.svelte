<script lang="ts">
  import IconSignInAlt from '~icons/fa-solid/sign-in-alt'
  import IconFa6SolidChevronRight from '~icons/fa6-solid/chevron-right'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import Skeleton from '$lib/components/ui/Skeleton.svelte'
  import { api_dictionaries_id_invites_accept } from '$api/dictionaries/[id]/invites/[invite_id]/accept/_call'
  import { invalidateAll } from '$app/navigation'
  import { page } from '$app/state'
  import { stream_resolve } from '$lib/state/stream-resolve.svelte'

  const { data } = $props()
  const { auth_user, dictionary, is_manager, is_contributor } = $derived(data)
  // Resolved on SSR/hydration; a pending streamed promise on client-nav. Sticky
  // through the invalidateAll after accepting. `undefined` = still loading,
  // `null` = no such invite.
  const invite_data = stream_resolve(() => data.invite)
  const invite = $derived(invite_data.value ?? null)
  const invite_pending = $derived(invite_data.value === undefined)
  const user = $derived(auth_user.user)

  async function accept_invite() {
    if (!invite) return
    const { error } = await api_dictionaries_id_invites_accept({ dict_id: invite.dictionary_id, invite_id: invite.id })
    if (error) {
      alert(`${page.data.t('misc.error')}: ${error.message}`)
      return
    }
    await invalidateAll()
  }
</script>

{#if invite_pending}
  <Skeleton width="16rem" height="1rem" />
  <div style="margin-top: 0.75rem"><Skeleton width="11rem" height="1rem" /></div>
{:else if invite?.status === 'sent'}
  <p style="font-weight: 600; margin-bottom: 0.5rem">
    {page.data.t('invite.invited_by')}: {invite.inviter_email}
  </p>
  <p style="font-weight: 600; margin-bottom: 0.5rem">
    {page.data.t('invite.role')}: {invite.role}
  </p>
  {#if user}
    {#if is_manager}
      <p style="margin-bottom: 0.5rem">
        You are already a manager.
      </p>
      <HeadlessButton class="btn btn-default" href={`/${dictionary.url}/entries`}>
        {page.data.t('dictionary.entries')}
        <IconFa6SolidChevronRight class="rtl-x-flip" style="margin-top: -0.25rem" />
      </HeadlessButton>
    {:else if is_contributor && invite.role === 'contributor'}
      <p style="margin-bottom: 0.5rem">
        You are already a contributor.
      </p>
      <HeadlessButton class="btn btn-default" href={`/${dictionary.url}/entries`}>
        {page.data.t('dictionary.entries')}
        <IconFa6SolidChevronRight class="rtl-x-flip" style="margin-top: -0.25rem" />
      </HeadlessButton>
    {:else}
      <HeadlessButton class="btn-primary btn-default" onclick={accept_invite}>{page.data.t('invite.accept_invitation')}</HeadlessButton>

      <div class="terms-note">
        {page.data.t('terms.agree_by_submit')}
        <a href="/terms" style="text-decoration-line: underline">
          {page.data.t('dictionary.terms_of_use')}
        </a>
        .
      </div>
    {/if}
  {:else}
    <ShowHide>
      {#snippet children({ show, toggle })}
        <HeadlessButton class="btn-ghost btn-default" onclick={toggle}>
          <IconSignInAlt />
          <span style="margin-left: 0.25rem">
            {page.data.t('header.login')}
          </span>
        </HeadlessButton>
        {#if show}
          {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
            <AuthModal on_close={toggle} />
          {/await}
        {/if}
      {/snippet}
    </ShowHide>
  {/if}
{:else if invite?.status === 'claimed'}
  <p style="font-weight: 600; margin-bottom: 0.5rem">
    {page.data.t('invite.invitation_claimed')}
  </p>

  <HeadlessButton class="btn btn-default" href={`/${dictionary.url}/entries`}>
    {page.data.t('dictionary.entries')}
    <IconFa6SolidChevronRight class="rtl-x-flip" style="margin-top: -0.25rem" />
  </HeadlessButton>
{:else if !user}
  {page.data.t('header.please_create_account')}
  <ShowHide>
    {#snippet children({ show: hide, toggle })}
      {#if !hide}
        {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
          <AuthModal
            context="force"
            on_close={toggle} />
        {/await}
      {/if}
    {/snippet}
  </ShowHide>
{:else}
  <p style="font-weight: 600">
    {page.data.t('invite.invalid_invitation')}
  </p>
{/if}

<style>
  .terms-note {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
  }
</style>
