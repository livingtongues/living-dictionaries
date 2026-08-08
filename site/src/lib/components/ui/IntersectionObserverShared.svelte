<script module>
  let observer
  // As each element registers, map Elements to Callbacks so an element's intersection change invokes its callback.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- module-level element→callback registry, not reactive state
  const mapping = new Map()

  function add(element, callback) {
    mapping.set(element, callback)
    observer.observe(element)
  }
  function remove(element) {
    const deleted = mapping.delete(element)
    if (deleted)
      observer.unobserve(element)
  }
</script>

<script>
  import { onDestroy, onMount } from 'svelte'

  let {
    once = false,
    intervalMs = undefined,
    top = 0,
    bottom = 0,
    left = 0,
    right = 0,
    threshold = 0,
    on_intersected = undefined,
    on_hidden = undefined,
    children,
  } = $props()

  let intersecting = $state(false)
  let container = $state()
  let child_element
  let interval = $state()

  onMount(() => {
    child_element = container.firstElementChild
    if (!child_element)
      return console.error('IntersectionObserver: No child element found')

    if (typeof IntersectionObserver !== 'undefined') {
      if (!observer) {
        const is_iframe = window !== window.parent
        const root = is_iframe ? window.document : null
        const root_margin = `${top}px ${right}px ${bottom}px ${left}px`
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const callback = mapping.get(entry.target)
              callback?.(entry.isIntersecting)
            }
          },
          { root, rootMargin: root_margin, threshold },
        )
      }
      const fired_when_intersecting_changes = (is_intersecting) => {
        if (once && is_intersecting)
          remove(child_element)
        if (is_intersecting)
          on_intersected?.()
        intersecting = is_intersecting
      }
      add(child_element, fired_when_intersecting_changes)
      return () => remove(child_element)
    }

    function handler() {
      const bcr = child_element.getBoundingClientRect()
      intersecting = bcr.bottom + bottom > 0 && bcr.right + right > 0 && bcr.top - top < window.innerHeight && bcr.left - left < window.innerWidth
      if (intersecting && once)
        window.removeEventListener('scroll', handler)
    }
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  })

  $effect(() => {
    if (intersecting === true) {
      if (intervalMs) {
        interval = setInterval(() => {
          if (intersecting === true)
            on_intersected?.()
        }, intervalMs)
        return () => clearInterval(interval)
      }
    } else {
      on_hidden?.()
    }
  })

  onDestroy(() => {
    clearInterval(interval)
  })
</script>

<div style="display: contents" bind:this={container}>
  {@render children?.({ intersecting })}
</div>

<!-- Tips from:
https://svelte.dev/repl/c461dfe7dbf84998a03fdb30785c27f3?version=3.16.7
https://github.com/metonym/svelte-intersection-observer
https://www.bennadel.com/blog/3954-intersectionobserver-api-performance-many-vs-shared-in-angular-11-0-5.htm -->
