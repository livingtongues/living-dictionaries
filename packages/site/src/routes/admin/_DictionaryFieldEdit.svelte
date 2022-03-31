<script lang="ts">
  import { updateOnline } from '$sveltefirets';
  export let field;
  export let value;
  export let dictionaryId;

  let debouncedSaveTimer;
  let unsaved = false;
  function valueChanged() {
    unsaved = true;
    clearTimeout(debouncedSaveTimer);
    debouncedSaveTimer = setTimeout(save, 2000);
  }

  async function save() {
    try {
      await updateOnline(`dictionaries/${dictionaryId}`, { [field]: value });
      unsaved = false;
    } catch (err) {
      alert(err);
    }
    // const data = await db.collection('dictionaries').doc(dictionaryId).get();
    // if (data.exists) {
    //   console.log(data.data());
    // } else {
    //   this.error("no data");
    // }
  }
</script>

<input bind:value on:input={valueChanged} class:unsaved />

<style>
  input.unsaved {
    outline: solid 1px #00cc00;
  }
</style>
