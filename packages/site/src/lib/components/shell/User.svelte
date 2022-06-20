<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { getStores } from '$app/stores';
  import { admin, user as userStore } from '$lib/stores';
  import { logOut } from 'sveltefirets';
  import { firebaseConfig } from '$lib/firebaseConfig';
  import Avatar from 'svelte-pieces/shell/Avatar.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import Menu from 'svelte-pieces/shell/Menu.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import type { IUser } from '@living-dictionaries/types';

  // Deep import not working, so copying function here temporarily
  // import { clickoutside } from 'svelte-pieces/actions/clickoutside.js';
  function clickoutside(node) {
    const handleClick = (event) => {
      if (node && !node.contains(event.target) && !event.defaultPrevented) {
        node.dispatchEvent(new CustomEvent('clickoutside'));
      }
    };
    document.addEventListener('click', handleClick, true);
    return {
      destroy() {
        document.removeEventListener('click', handleClick, true);
      },
    };
  }

  $: user = $userStore || ($session && ($session.user as IUser)) || null;
  const { session } = getStores();
</script>

{#if user}
  <ShowHide let:show let:toggle let:set>
    <div class="relative flex-shrink-0" use:clickoutside on:clickoutside={() => set(false)}>
      <button class="px-3 py-1" type="button" on:click={toggle}>
        <Avatar {user} />
      </button>
      {#if show}
        <Menu portalTarget="#direction" class="right-2 rtl:left-2 top-11">
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
            <button on:click={logOut}>{$_('account.log_out', { default: 'Log Out' })}</button>
          {/if}
          {#if firebaseConfig.projectId === 'talking-dictionaries-dev'}
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
    <Button form="text" onclick={toggle}>
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
