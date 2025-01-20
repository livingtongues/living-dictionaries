<script lang="ts">
  import { BadgeArrayEmit, ShowHide } from 'svelte-pieces'
  import { addOnline } from 'sveltefirets'
  import type { DictionaryView, HelperRoles, IHelper } from '@living-dictionaries/types'
  import { removeDictionaryCollaborator, removeDictionaryContributor, removeDictionaryManager } from '$lib/helpers/dictionariesManaging'

  export let helpers: IHelper[] = []
  export let dictionary: DictionaryView
  export let role: HelperRoles

  async function remove(helper: IHelper, dictionary_id: string, role: HelperRoles) {
    try {
      if (role === 'manager')
        await removeDictionaryManager(helper, dictionary_id)

      if (role === 'writeInCollaborator')
        await removeDictionaryCollaborator(helper, dictionary_id)

      if (role === 'contributor')
        await removeDictionaryContributor(helper, dictionary_id)
    } catch (err) {
      alert(`Error: ${err}`)
    }
  }

  async function addWriteInCollaborator() {
    const name = prompt('Name?')
    if (name)
      await addOnline(`dictionaries/${dictionary.id}/writeInCollaborators`, { name })
  }
</script>

<ShowHide let:show let:toggle={toggleSelectUserModal}>
  <BadgeArrayEmit
    strings={helpers.map(h => h.name)}
    canEdit
    addMessage="Add"
    on:itemclicked={e => alert(helpers[e.detail.index].id)}
    on:itemremoved={async e => await remove(helpers[e.detail.index], dictionary.id, role)}
    on:additem={role === 'writeInCollaborator' ? addWriteInCollaborator : toggleSelectUserModal} />

  {#if show && role !== 'writeInCollaborator'}
    {#await import('../users/SelectUserModal.svelte') then { default: SelectUserModal }}
      <SelectUserModal {dictionary} {role} on_close={toggleSelectUserModal} />
    {/await}
  {/if}
</ShowHide>
