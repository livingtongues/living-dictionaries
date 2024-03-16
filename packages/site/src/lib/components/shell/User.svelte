<script lang="ts">
  import { page } from '$app/stores';
  import { admin, user as userStore } from '$lib/stores';
  import { logOut, firebaseConfig, authState } from 'sveltefirets';
  import { Button, Menu, ShowHide, Avatar } from 'svelte-pieces';
  import type { IUser } from '@living-dictionaries/types';

  $: user = $userStore || ($authState === undefined && ($page.data?.user as IUser)) || null;
// only use page data set from the cookie before authState has been inited so that when a user logs out, the user value here doesn't fall back to the page data  value initially set by the cookie. Even though the cookie is cleared on logout, the page data is not updated.
</script>

{#if user}
  <ShowHide let:show let:toggle let:set>
    <div class="relative flex-shrink-0">
      <button class="px-3 py-1" type="button" on:click={toggle}>
        <Avatar {user} />
      </button>
      {#if show}
        <Menu portalTarget="#direction" class="right-2 rtl:left-2 top-11" onclickoutside={() => set(false)}>
          <div class="px-4 py-2 text-xs font-semibold text-gray-600">{user.displayName}</div>
          <div class="px-4 py-2 -mt-3 text-xs text-gray-600 border-b">{user.email}</div>
          {#if $admin}
            <a href="/admin">
              Admin Panel
              <i class="fas fa-key" />
            </a>
          {/if}
          <a href="/account"> {$page.data.t('account.account_settings')} </a>
          {#if userStore}
            <button type="button" on:click={logOut}>{$page.data.t('account.log_out')}</button>
          {/if}
          {#if firebaseConfig.projectId === 'talking-dictionaries-dev'}
            <button
              type="button"
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
    <Button form="text" onclick={toggle}>
      <i class="far fa-sign-in" />
      <span class="ml-1 hidden sm:inline">
        {$page.data.t('header.login')}
      </span>
    </Button>
    {#if show}
      {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
        <AuthModal on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}
