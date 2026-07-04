<script lang="ts">
  import Consumer from '$lib/Consumer.svelte'
  import { make_live_db } from '$lib/live-db.svelte'

  const db = make_live_db({ hoist_creation: true })
</script>

<h1>fixed — store created outside the reaction</h1>
<a href="/broken">→ broken variant</a>
<Consumer {db} variant="fixed" />
