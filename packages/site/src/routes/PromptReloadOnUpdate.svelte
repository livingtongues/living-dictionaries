<script lang="ts">
  let service_worker_updated = $state(false)

  if ('serviceWorker' in navigator) {
    let is_initial_sw_activation = !navigator.serviceWorker.controller

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (is_initial_sw_activation) {
        console.info('Initial service worker activated.')
        is_initial_sw_activation = false
      } else {
        console.info('Site has been updated by a new service worker. Prompting the user to refresh.')
        service_worker_updated = true
      }
    })
  }
</script>

{#if service_worker_updated}
  <div class="fixed top-3 inset-x-0 flex justify-center z-100">
    <div class="bg-gray-700 text-white p-3 rounded shadow-lg flex items-center">
      <div class="mr-2">New version available.</div>
      <button type="button" onclick={() => location.reload()} class="bg-blue-500 text-white px-3 py-1.5 rounded">Reload</button>
    </div>
  </div>
{/if}
