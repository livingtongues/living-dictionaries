<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import EditFieldModal from '$lib/components/entry/EditFieldModal.svelte'
  import { PRIMARY_ORTHOGRAPHY_CODE } from '$lib/db/schemas/shared.types'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    class?: string
  }

  const props: Props = $props()

  const { dict_db, dictionary } = $derived(page.data)

  async function add_sentence(new_value: string) {
    if (!new_value) return
    const [sentence] = await dict_db.sentences.insert({ text: { [PRIMARY_ORTHOGRAPHY_CODE]: new_value } })
    await goto(`/${dictionary.url}/sentence/${sentence.id}`)
  }
</script>

<ShowHide>
  {#snippet children({ show, toggle })}
    <Button class="add-entry-button {props.class}" form="filled" onclick={toggle}>
      <IconFaSolidPlus class="icon-inline" style="margin-top: -0.25rem" />
      {page.data.t('sentence.add')}
    </Button>
    {#if show}
      <EditFieldModal
        field="example_sentence"
        display={page.data.t('sentence.sentence')}
        on_update={add_sentence}
        on_close={toggle} />
    {/if}
  {/snippet}
</ShowHide>
