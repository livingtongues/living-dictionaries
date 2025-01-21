<script lang="ts">
  import type { DictionaryView, IUser } from '@living-dictionaries/types'
  import { Button, Modal } from 'svelte-pieces'
  import { Collection } from 'sveltefirets'
  import { addDictionaryContributor, addDictionaryManager } from '$lib/helpers/dictionariesManaging'
  import Filter from '$lib/components/Filter.svelte'

  export let user: IUser
  export let role: 'manager' | 'contributor'
  export let on_close: () => void

  let dictionariesType: DictionaryView[]

  async function add(dictionaryId: string) {
    try {
      if (role === 'manager')
        await addDictionaryManager({ id: user.uid, name: user.displayName }, dictionaryId)
      else
        await addDictionaryContributor({ id: user.uid, name: user.displayName }, dictionaryId)

      on_close()
    } catch (err) {
      alert(`Error: ${err}`)
    }
  }
</script>

<Modal on:close={on_close}>
  <span slot="heading">
    Select Dictionary to let {user.displayName} be a {role}
  </span>
  <Collection path="dictionaries" startWith={dictionariesType} let:data={dictionaries}>
    <Filter
      items={dictionaries}
      let:filteredItems={filteredDictionaries}
      placeholder="Search dictionaries">
      {#each filteredDictionaries as dictionary}
        <Button
          onclick={async () => await add(dictionary.id)}
          color="green"
          form="simple"
          class="w-full !text-left">{dictionary.name} <small>({dictionary.id})</small></Button>
      {/each}

      <div class="modal-footer space-x-1">
        <Button onclick={on_close} color="black">Cancel</Button>
      </div>
    </Filter>
  </Collection>
</Modal>
