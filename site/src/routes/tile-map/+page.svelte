<script lang="ts">
  import { onMount } from 'svelte'
  import { zoom as d3_zoom, select, zoomIdentity } from 'd3'
  import { create_tile_map } from './tile-renderer'
  import type { MapStats } from './tile-renderer'

  let canvas = $state<HTMLCanvasElement>()
  let stats = $state<MapStats>()

  onMount(() => {
    const map = create_tile_map({ canvas, on_stats: next => stats = next })
    // max 40 ≈ display z7.5 — deeper overzoom exposes landcover seams at z6 tile edges
    const behavior = d3_zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 40])
      .on('zoom', event => map.set_transform(event.transform))
    const selection = select(canvas).call(behavior)
    const resize_observer = new ResizeObserver(() => map.resize())
    resize_observer.observe(canvas)
    map.resize()

    // test hook for driving the view from puppeteer
    ;(window as unknown as { __tile_map: unknown }).__tile_map = {
      zoom_to: (lon: number, lat: number, k: number) => {
        const point = map.project_base([lon, lat])
        if (!point) return
        const next = zoomIdentity
          .translate(canvas.clientWidth / 2 - k * point[0], canvas.clientHeight / 2 - k * point[1])
          .scale(k)
        selection.call(behavior.transform, next)
      },
    }

    return () => {
      resize_observer.disconnect()
      map.destroy()
    }
  })
</script>

<svelte:head>
  <title>Tile map tracer — Equal Earth + PMTiles</title>
</svelte:head>

<div class="page">
  <canvas bind:this={canvas}></canvas>
  {#if stats}
    <div class="hud">
      k {stats.k.toFixed(2)} · view z{stats.display_z.toFixed(2)} → data z{stats.data_z}
      · tiles {stats.drawn}{stats.pending ? ` (+${stats.pending} loading)` : ''} · cache {stats.cached}
      · frame {stats.frame_ms.toFixed(1)}ms
    </div>
  {/if}
  <div class="attribution">
    <a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
  </div>
</div>

<style>
  .page {
    position: fixed;
    inset: 0;
    background: #f8f7f4;
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    touch-action: none;
  }

  canvas:active {
    cursor: grabbing;
  }

  .hud {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(255, 255, 255, 0.85);
    font: 12px monospace;
    padding: 4px 8px;
    border-radius: 6px;
    pointer-events: none;
  }

  .attribution {
    position: absolute;
    bottom: 6px;
    right: 8px;
    font-size: 11px;
    background: rgba(255, 255, 255, 0.7);
    padding: 2px 6px;
    border-radius: 4px;
  }
</style>
