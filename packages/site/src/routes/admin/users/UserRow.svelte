<script lang="ts">
  import { updateOnline } from 'sveltefirets';
  import type { IUser } from '@living-dictionaries/types';
  import { printDate } from '$lib/helpers/time';
  import DictionariesHelping from '../dictionaries/DictionariesHelping.svelte';
  import { IntersectionObserverShared } from 'svelte-pieces';
  import { page } from '$app/stores';

  export let user: IUser;
  $: ({admin} = $page.data)
</script>

<tr title={$admin > 1 && JSON.stringify(user, null, 1)}>
  <td class="font-bold">
    {user.displayName}
  </td>
  <td>
    {user.email}
  </td>
  <td>
    <IntersectionObserverShared bottom={2000} let:intersecting once>
      <div style="width: 200px;" />
      {#if intersecting}
        <DictionariesHelping role="manager" {user} />
      {/if}
    </IntersectionObserverShared></td>
  <td>
    <IntersectionObserverShared bottom={2000} let:intersecting once>
      <div style="width: 200px;" />
      {#if intersecting}
        <DictionariesHelping role="contributor" {user} />
      {/if}
    </IntersectionObserverShared></td>
  <td class="whitespace-nowrap">
    {#if user.lastVisit}{printDate(user.lastVisit.toDate())}{/if}
  </td>
  <td class="whitespace-nowrap">
    {#if user.createdAt}{printDate(user.createdAt.toDate())}{/if}
  </td>
  <td>
    {#if user.unsubscribe}
      <button
        type="button"
        title="Click to re-subscribe"
        class="hover:underline text-red-600"
        on:click={async () => {
          if (confirm('Re-subscribe user?')) {
            await updateOnline(`users/${user.uid}`, {
              unsubscribe: null,
            });
          }
        }}>{printDate(user.unsubscribe.toDate())}</button>
    {:else}
      <button
        type="button"
        class="text-xs hover:underline text-gray-700"
        on:click={async () => {
          await updateOnline(`users/${user.uid}`, {
            unsubscribe: new Date(),
          });
        }}>Mark Unsubscribed</button>
    {/if}
  </td>
</tr>
