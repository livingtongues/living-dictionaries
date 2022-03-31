<script lang="ts">
  import {
    removeDictionaryContributor,
    removeDictionaryManager,
  } from '$lib/helpers/dictionariesManaging';

  import type { IUser } from '$lib/interfaces';
  import { db } from '$sveltefirets';
  import BadgeArrayEmit from '$svelteui/data/BadgeArrayEmit.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import { collectionGroup, onSnapshot, query, Unsubscribe, where } from 'firebase/firestore';
  import { onDestroy, onMount } from 'svelte';

  export let user: IUser;
  export let role: 'manager' | 'contributor' = 'manager';
  let dictionaryIds: string[] = [];
  let unsubscribe: Unsubscribe;

  onMount(() => {
    const q = query(
      collectionGroup(db, role === 'manager' ? 'managers' : 'contributors'),
      where('id', '==', user.uid)
    );
    unsubscribe = onSnapshot(q, (snapshot) => {
      dictionaryIds = snapshot.docs.map((doc) => doc.ref.path.match(/dictionaries\/(.*?)\//)[1]);
    });
  });

  onDestroy(() => {
    unsubscribe && unsubscribe();
  });
</script>

<ShowHide let:show let:toggle>
  <BadgeArrayEmit
    strings={dictionaryIds}
    canEdit
    addMessage="Add"
    on:itemclicked={(e) => window.open(`/${e.detail.value}`, '_blank')}
    on:itemremoved={(e) => {
      if (role === 'manager') {
        removeDictionaryManager({ id: user.uid, name: user.displayName }, e.detail.value);
      } else {
        removeDictionaryContributor({ id: user.uid, name: user.displayName }, e.detail.value);
      }
    }}
    on:additem={toggle} />
  {#if show}
    {#await import('./_SelectDictionaryModal.svelte') then { default: SelectDictionaryModal }}
      <SelectDictionaryModal {role} {user} on:close={toggle} />
    {/await}
  {/if}
</ShowHide>
