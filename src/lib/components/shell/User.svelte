<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { getStores } from '$app/stores';
  import { admin } from '$lib/stores';
  import { dev } from '$app/env';
  import { clickOutside } from '$svelteui/actions/clickOutside';
  import Avatar from '$svelteui/shell/Avatar.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import Menu from '$svelteui/shell/Menu.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import type { IUser } from '$lib/interfaces';
  import { user as userStore } from '$sveltefire/user';

  $: user = $userStore || ($session && ($session.user as IUser)) || null;
  const { session } = getStores();
</script>

{#if user}
  <ShowHide let:show let:toggle let:set>
    <div class="relative flex-shrink-0" use:clickOutside on:clickOutside={() => set(false)}>
      <button class="px-3 py-1" type="button" on:click={toggle}>
        <Avatar {user} />
      </button>
      {#if show}
        <Menu class="ltr:right-2 rtl:left-2 top-11">
          <div class="px-4 py-2 text-xs font-semibold text-gray-600">{user.displayName}</div>
          <div class="px-4 py-2 -mt-3 text-xs text-gray-600 border-b">{user.email}</div>
          {#if $admin}
            <a href="/admin">
              Admin Panel
              <i class="fas fa-key" />
            </a>
          {/if}
          <a href="/account"> {$_('account.account_settings', { default: 'Account Settings' })} </a>
          {#if userStore}
            <button on:click={() => userStore.signOut(session)}
              >{$_('account.log_out', { default: 'Log Out' })}</button>
          {/if}
          {#if dev}
            <button
              on:click={async () => {
                const roleNumber = +prompt('Enter 0, 1, or 2');
                const { getFunctions, httpsCallable } = await import('firebase/functions');
                await httpsCallable(
                  getFunctions(),
                  'updateDevAdminRole'
                )({
                  role: roleNumber,
                });
              }}>
              Set Admin Role Level (dev only)
            </button>
          {/if}
        </Menu>
      {/if}
    </div>
  </ShowHide>
{:else}
  <ShowHide let:show let:toggle>
    <Button form="text" class="print:hidden" onclick={toggle}>
      <i class="far fa-sign-in" />
      <span class="ml-1 hidden sm:inline">
        {$_('header.login', { default: 'Log In' })}
      </span>
    </Button>
    {#if show}
      {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
        <AuthModal on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}
