<script lang="ts">
  import { t } from "svelte-i18n";
  import { createEventDispatcher } from "svelte";
  import { Button, Modal } from "svelte-pieces";
  import MultiSelect from "$lib/components/ui/MultiSelect.svelte";

  const dispatch = createEventDispatcher<{
    close: boolean;
    update: string[];
  }>();
  const close = () => dispatch("close");

  export let value: string[];
  export let placeholder: string;
  export let options: { key: string, name: string }[];

  function save() {
    dispatch("update", value);
    close();
  }
</script>

<Modal noscroll on:close>
  <span slot="heading"><slot name="heading" /></span>

  <form on:submit|preventDefault={save}>
    <MultiSelect bind:value {placeholder}>
      <option />
      {#each options as {key, name}}
        <option value={key}>{name}</option>
      {/each}
    </MultiSelect>

    <div class="min-h-[50vh]" />

    <div class="modal-footer space-x-1">
      <Button onclick={close} form="simple" color="black">
        {$t("misc.cancel", { default: "Cancel" })}
      </Button>

      <Button type="submit" form="filled">
        {$t("misc.save", { default: "Save" })}
      </Button>
    </div>
  </form>
</Modal>
