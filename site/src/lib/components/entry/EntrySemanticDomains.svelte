<script lang="ts">
  import { stopPropagation } from 'svelte/legacy'

  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte'
  import { page } from '$app/stores'
  import { semanticDomains } from '$lib/mappings/semantic-domains'
  import IconFaSolidTimes from '~icons/fa-solid/times'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    semantic_domain_keys: string[]
    write_in_semantic_domains: string[]
    can_edit?: boolean
    show_plus?: boolean
    on_update: (new_value: string[]) => void
    on_update_write_in: (new_value: string[]) => void
  }

  const {
    semantic_domain_keys,
    write_in_semantic_domains,
    can_edit = false,
    show_plus = true,
    on_update,
    on_update_write_in,
  }: Props = $props()

  const translated_semantic_domain_options = $derived(semanticDomains.map(domain => ({
    value: domain.key,
    name: $page.data.t({ dynamicKey: `sd.${domain.key}`, fallback: domain.name }),
  })) satisfies SelectOption[])

  function deleteWriteIn(domain: string) {
    if (!confirm(`${$page.data.t('misc.delete')}?`)) return
    on_update_write_in(write_in_semantic_domains.filter(d => d !== domain))
  }
</script>

<ModalEditableArray
  values={semantic_domain_keys || []}
  options={translated_semantic_domain_options}
  {can_edit}
  showPlus={show_plus}
  placeholder={$page.data.t('entry_field.semantic_domains')}
  {on_update}>
  {#snippet heading()}
    <span>{$page.data.t('entry.select_semantic_domains')}</span>
  {/snippet}
  {#snippet additional()}

    {#each write_in_semantic_domains || [] as domain (domain)}
      <div class="write-in-chip">
        <i>{domain}</i>
        {#if can_edit}
          <button
            type="button"
            class="remove-write-in"
            title="Remove"
            onclick={stopPropagation(() => deleteWriteIn(domain))}>
            <IconFaSolidTimes class="icon-inline" />
          </button>
        {/if}
      </div>
      <div style="width: 0.25rem"></div>
    {/each}

  {/snippet}
  {#snippet plus()}

    {#if can_edit && show_plus && !(semantic_domain_keys?.length || write_in_semantic_domains?.length)}
      <IconFaSolidPlus class="icon-inline" style="opacity: 0.4; margin-top: 0.25rem; margin-bottom: 0.25rem" />
    {/if}

  {/snippet}
</ModalEditableArray>

<style>
  .write-in-chip {
    padding: 0.25rem 0.5rem;
    line-height: 1.25;
    font-size: 0.75rem;
    background-color: rgb(219 234 254); /* blue-100 */
    border-radius: 0.25rem;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    display: flex;
    align-items: center;
  }

  .remove-write-in {
    cursor: pointer;
    justify-content: center;
    align-items: center;
    display: flex;
    opacity: 0.5;
    border-radius: 9999px;
    height: 1rem;
    width: 1rem;
    margin-left: 0.25rem;
  }

  .remove-write-in:hover {
    opacity: 1;
  }
</style>
