<script lang="ts">
  import Consumer from '$lib/Consumer.svelte'
  import { make_live_db } from '$lib/live-db.svelte'

  const db = make_live_db({ hoist_creation: false })
</script>

<h1>broken — store created inside the reaction</h1>
<a href="/fixed">→ fixed variant</a>
<Consumer {db} variant="broken" />
