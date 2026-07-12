<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
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
    <HeadlessButton class="btn-primary btn-default add-entry-button {props.class}" onclick={toggle}>
      <IconFaSolidPlus style="margin-top: -0.25rem" />
      {page.data.t('sentence.add')}
    </HeadlessButton>
    {#if show}
      <EditFieldModal
        field="example_sentence"
        display={page.data.t('sentence.sentence')}
        on_update={add_sentence}
        on_close={toggle} />
    {/if}
  {/snippet}
</ShowHide>
