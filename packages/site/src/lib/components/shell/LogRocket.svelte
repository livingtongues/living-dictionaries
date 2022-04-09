<script lang="ts">
  // User Experience Logging, 3 second delayed init after load completes
  async function loadLogRocket() {
    console.log('load in logrocket');
    (await import('logrocket')).default.init('wsolfu/td-dev');
  }

  if (document.readyState == 'loading') {
    document.addEventListener('DOMContentLoaded', loadLogRocket);
  } else {
    setTimeout(() => {
      loadLogRocket();
    }, 3000);
  }
</script>
