<script lang="ts">
  import type { IUser } from '@living-dictionaries/types'
  import { getDb } from 'sveltefirets'
  import { BadgeArrayEmit, ShowHide } from 'svelte-pieces'
  import { type Unsubscribe, collectionGroup, onSnapshot, query, where } from 'firebase/firestore'
  import { onDestroy, onMount } from 'svelte'
  import { removeDictionaryContributor, removeDictionaryManager } from '$lib/helpers/dictionariesManaging'

  export let user: IUser
  export let role: 'manager' | 'contributor' = 'manager'
  let dictionaryIds: string[] = []
  let unsubscribe: Unsubscribe

  onMount(() => {
    const q = query(
      collectionGroup(getDb(), role === 'manager' ? 'managers' : 'contributors'),
      where('id', '==', user.uid),
    )
    unsubscribe = onSnapshot(q, (snapshot) => {
      dictionaryIds = snapshot.docs.map(doc => doc.ref.path.match(/dictionaries\/(.*?)\//)[1])
    })
  })

  onDestroy(() => {
    unsubscribe?.()
  })
</script>

<ShowHide let:show let:toggle>
  <BadgeArrayEmit
    strings={dictionaryIds}
    canEdit
    addMessage="Add"
    on:itemclicked={e => window.open(`/${e.detail.value}`, '_blank')}
    on:itemremoved={(e) => {
      if (role === 'manager')
        removeDictionaryManager({ id: user.uid, name: user.displayName }, e.detail.value)
      else
        removeDictionaryContributor({ id: user.uid, name: user.displayName }, e.detail.value)
    }}
    on:additem={toggle} />
  {#if show}
    {#await import('./SelectDictionaryModal.svelte') then { default: SelectDictionaryModal }}
      <SelectDictionaryModal {role} {user} on_close={toggle} />
    {/await}
  {/if}
</ShowHide>
