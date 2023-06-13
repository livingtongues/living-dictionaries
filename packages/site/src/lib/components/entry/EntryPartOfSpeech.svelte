<script lang="ts">
  import { t } from "svelte-i18n";
  import {
    Modal,
    ShowHide,
    DataList,
    ReactiveSet,
    BadgeArrayEmit,
  } from "svelte-pieces";
  import {
    partsOfSpeech,
    mayanPOS,
    mayanDictionaries,
  } from "$lib/mappings/parts-of-speech";
  import { createEventDispatcher } from "svelte";

  export let value: string[];
  export let canEdit = false;
  export let dictionaryId: string = undefined;

  const dispatch = createEventDispatcher<{
    valueupdate: {
      field: 'ps';
      newValue: string[];
    };
  }>();

  $: translateValues = (values: string[]) => {
    return t ? values.map((v) => $t("ps." + v, { default: v })) : values;
  };
</script>

{#if value?.length || canEdit}
  <div class="md:px-2" class:order-2={!value.length}>
    <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t("entry.ps")}</div>
    {#if canEdit}
      <ReactiveSet
        input={value}
        let:value={editedParts}
        let:add
        let:remove
        on:modified={({ detail: newValue }) => {
          dispatch("valueupdate", {
            field: "ps",
            newValue,
          });
        }}
      >
        <ShowHide let:show let:toggle>
          <BadgeArrayEmit
            strings={translateValues(editedParts)}
            addMessage={$t("misc.add", { default: "Add" })}
            canEdit
            on:itemremoved={({ detail: { index } }) => {
              remove(editedParts[index]);
            }}
            on:additem={toggle}
          />
          {#if show}
            <Modal noscroll on:close={toggle}>
              <span slot="heading"
                >{$t("entry.ps", { default: "Part of Speech" })}</span
              >
              <DataList
                type="search"
                class="form-input w-full leading-none"
                resetOnSelect
                on:selected={(e) => {
                  add(e.detail.value);
                  toggle();
                }}
              >
                {#if mayanDictionaries.includes(dictionaryId)}
                  {#each mayanPOS as pos}
                    <option data-value={pos}>{pos}</option>
                  {/each}
                {/if}
                {#each partsOfSpeech as pos}
                  <option data-value={pos.enAbbrev}
                    >{$t("ps." + pos.enAbbrev, { default: pos.enName })}</option
                  >
                {/each}
              </DataList>
            </Modal>
          {/if}
        </ShowHide>
      </ReactiveSet>
    {:else}
      <BadgeArrayEmit strings={value} />
    {/if}
    <div class="border-b-2 pb-1 mb-2" />
  </div>
{/if}
