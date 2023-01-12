<script lang="ts">
  import IpaKeyboard from './IpaKeyboard.svelte';
  import { Story } from 'kitbook';
</script>

<!-- prettier-ignore -->
# IPA Keyboard

<Story>
  <IpaKeyboard>
    <input type="text" value="some sta̤rting value" class="form-input block w-full mb-2" />
  </IpaKeyboard>
</Story>

<Story name="using target">
  <input id="targetMe" type="text" value="input has id" class="form-input block w-full mb-2" />
  <IpaKeyboard target="#targetMe" />
</Story>
