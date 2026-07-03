<script lang="ts">
  import IconFa6SolidChevronRight from '~icons/fa6-solid/chevron-right'
  import { Button, ShowHide } from '$lib/svelte-pieces'
  import { api_dictionaries_id_invites_accept } from '$api/dictionaries/[id]/invites/[invite_id]/accept/_call'
  import { invalidateAll } from '$app/navigation'
  import { page } from '$app/state'

  const { data } = $props()
  const { auth_user, dictionary, is_manager, is_contributor, invite } = $derived(data)
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

{#if invite?.status === 'sent'}
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
      <Button href={`/${dictionary.url}/entries`}>
        {page.data.t('dictionary.entries')}
        <IconFa6SolidChevronRight class="icon-inline rtl-x-flip" style="margin-top: -0.25rem" />
      </Button>
    {:else if is_contributor && invite.role === 'contributor'}
      <p style="margin-bottom: 0.5rem">
        You are already a contributor.
      </p>
      <Button href={`/${dictionary.url}/entries`}>
        {page.data.t('dictionary.entries')}
        <IconFa6SolidChevronRight class="icon-inline rtl-x-flip" style="margin-top: -0.25rem" />
      </Button>
    {:else}
      <Button form="filled" onclick={accept_invite}>{page.data.t('invite.accept_invitation')}</Button>

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
        <Button form="text" onclick={toggle}>
          <i class="far fa-sign-in"></i>
          <span style="margin-left: 0.25rem">
            {page.data.t('header.login')}
          </span>
        </Button>
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

  <Button href={`/${dictionary.url}/entries`}>
    {page.data.t('dictionary.entries')}
    <IconFa6SolidChevronRight class="icon-inline rtl-x-flip" style="margin-top: -0.25rem" />
  </Button>
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
