<script> import { prepareDisplay, prepareHref } from './detectUrl'

export let string
</script>

<slot display={prepareDisplay(string)} href={prepareHref(string)} />
