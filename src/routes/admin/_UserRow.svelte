<script lang="ts">
  import { admin } from '$lib/stores';
  import { update } from '$sveltefire/firestore';
  import type { IUser } from '$lib/interfaces';
  import { printDate } from '$lib/helpers/time';
  import Button from '$svelteui/ui/Button.svelte';
  export let user: IUser;
  import { removeDictionaryManagePermission } from '$lib/helpers/dictionariesManaging';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
</script>

<tr title={$admin > 1 && JSON.stringify(user, null, 1)}>
  <td class="font-bold">
    {user.displayName}
  </td>
  <td>
    {user.email}
  </td>
  <td>
    {#if user.managing && user.managing.length}
      {#each user.managing as dictionaryId}
        <Button
          class="mr-1"
          onclick={() => removeDictionaryManagePermission(user, dictionaryId)}
          size="sm">
          {dictionaryId}
          <i class="far fa-times ml-1" />
        </Button>
      {/each}
    {/if}
    <ShowHide let:show let:toggle>
      <Button onclick={toggle} color="orange" size="sm">
        <i class="far fa-plus mr-1" />
        Add
      </Button>
      {#if show}
        {#await import('./_SelectDictionaryModal.svelte') then { default: SelectDictionaryModal }}
          <SelectDictionaryModal {user} on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  </td>
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
            await update(`users/${user.uid}`, {
              unsubscribe: null,
            });
          }
        }}>{printDate(user.unsubscribe.toDate())}</button>
    {:else}
      <button
        type="button"
        class="text-xs hover:underline text-gray-700"
        on:click={async () => {
          await update(`users/${user.uid}`, {
            unsubscribe: new Date(),
          });
        }}>Mark Unsubscribed</button>
    {/if}
  </td>
</tr>
