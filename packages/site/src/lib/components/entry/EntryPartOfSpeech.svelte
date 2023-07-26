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
      field: "ps";
      newValue: string[];
    };
  }>();
</script>

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
        strings={editedParts}
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
