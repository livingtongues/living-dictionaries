<script lang="ts" module>
  let observer: IntersectionObserver

  // As each element registers with the observer, map Elements to Callbacks so when an element's intersection changes its callback is invoked
  const mapping = new Map()

  function add(element: HTMLElement, callback: (isIntersecting: boolean) => void) {
    mapping.set(element, callback)
    observer.observe(element)
  }

  function remove(element: HTMLElement) {
    const deleted = mapping.delete(element)
    deleted && observer.unobserve(element)
  }
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  interface Props {
    /** Set to `true` to unobserve the element after it intersects the viewport. */
    once?: boolean
    intervalMs?: number
    /** only value passed to the first mounted of this component will be used and it won't respond to dynamic updates */
    top?: number
    /** only value passed to the first mounted of this component will be used and it won't respond to dynamic updates */
    bottom?: number
    /** only value passed to the first mounted of this component will be used and it won't respond to dynamic updates */
    left?: number
    /** only value passed to the first mounted of this component will be used and it won't respond to dynamic updates */
    right?: number
    /**
     * Percentage of element visibility to trigger an event.
     * Value must be between 0 and 1.
     */
    threshold?: number
    on_intersected?: () => void
    on_hidden?: () => void
    children?: import('svelte').Snippet<[any]>
  }

  const {
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
  }: Props = $props()

  let intersecting = $state(false)
  let container: HTMLDivElement = $state()
  let childElement: HTMLElement
  let interval: ReturnType<typeof setInterval> = $state()

  onMount(() => {
    childElement = container.firstElementChild as HTMLElement
    if (!childElement)
      return console.error('IntersectionObserver: No child element found')

    if (typeof IntersectionObserver !== 'undefined') {
      if (!observer) {
        const isIframe = window !== window.parent
        const root = isIframe ? window.document : null // Use the iframe's document as root if in an iframe

        const rootMargin = `${top}px ${right}px ${bottom}px ${left}px`

        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const callback = mapping.get(entry.target)
              callback && callback(entry.isIntersecting)
            }
          },
          {
            root,
            rootMargin,
            threshold,
          },
        )
      }

      const fired_when_intersecting_changes = (isIntersecting: boolean) => {
        if (once && isIntersecting)
          remove(childElement)
        if (isIntersecting)
          on_intersected?.()
        intersecting = isIntersecting
      }
      add(childElement, fired_when_intersecting_changes)

      return () => remove(childElement)
    }
  })

  $effect(() => {
    if (intersecting === true) {
      if (intervalMs) {
        interval = setInterval(() => {
          if (intersecting === true)
            on_intersected?.()
        }, intervalMs)
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
