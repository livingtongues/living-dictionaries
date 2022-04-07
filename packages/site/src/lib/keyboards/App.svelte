<script lang="ts">
	import Ipa from "./IPA.svelte";
	import Keyman from "./Keyman.svelte";
	let value = "";

	let languages = ['am', 'en', 'ar', 'as'];
</script>

<div class="p-3">
	<p>&nbsp;{value}</p>
	<Keyman {languages} currentLanguage="as" bind:value />
	<Ipa bind:value />
</div>
