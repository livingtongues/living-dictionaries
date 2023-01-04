<script lang="ts">
  import { t } from 'svelte-i18n';
  import BadgeArrayEmit from 'svelte-pieces/data/BadgeArrayEmit.svelte';
  import ReactiveSet from 'svelte-pieces/functions/ReactiveSet.svelte';
  import DataList from 'svelte-pieces/ui/DataList.svelte';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import { partsOfSpeech, mayanPOS, mayanDictionaries } from '$lib/mappings/parts-of-speech';

  export let value: string[] | string;
  export let canEdit = false;
  export let dictionaryId: string = undefined;

  // TODO: remove once strings POS are refactored out
  $: currentParts = (() => {
    if (typeof value === 'string') {
      return [value];
    } else return value || [];
  })();

  import { createEventDispatcher } from 'svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  const dispatch = createEventDispatcher<{
    valueupdate: {
      field: string;
      newValue: string[];
    };
  }>();
  function update(newValue: string[]) {
    dispatch('valueupdate', {
      field: 'ps',
      newValue,
    });
  }

  $: translateValues = (values: string[]) => {
    return t ? values.map((v) => $t('ps.' + v, { default: v })) : values;
  };
</script>

{#if canEdit}
  <ReactiveSet
    input={currentParts}
    let:value={editedParts}
    let:add
    let:remove
    on:modified={(e) => update(e.detail)}>
    <ShowHide let:show let:toggle>
      <BadgeArrayEmit
        strings={translateValues(editedParts)}
        addMessage={t ? $t('misc.add', { default: 'Add' }) : 'Add'}
        canEdit
        on:itemremoved={(e) => {
          remove(editedParts[e.detail.index]);
        }}
        on:additem={toggle} />
      {#if show}
        <Modal noscroll on:close={toggle}>
          <span slot="heading"
            >{t ? $t('entry.ps', { default: 'Part of Speech' }) : 'Part of Speech'}</span>
          <DataList
            type="search"
            class="form-input w-full leading-none"
            resetOnSelect
            on:selected={(e) => {
              add(e.detail.value);
              toggle();
            }}>
            {#if mayanDictionaries.includes(dictionaryId)}
              {#each mayanPOS as pos}
                <option data-value={pos}>{pos}</option>
              {/each}
            {/if}
            {#each partsOfSpeech as pos}
              <option data-value={pos.enAbbrev}
                >{t ? $t('ps.' + pos.enAbbrev, { default: pos.enAbbrev }) : pos.enName}</option>
            {/each}
          </DataList>
        </Modal>
      {/if}
    </ShowHide>
  </ReactiveSet>
{:else}
  <BadgeArrayEmit strings={currentParts} />
{/if}
