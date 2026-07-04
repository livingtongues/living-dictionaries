/**
 * Canvas can't resolve CSS vars or color-mix() itself, so the map component
 * renders hidden swatch divs (styled with theme vars in its <style> block) and
 * we read the browser-resolved rgb values off them.
 */
export interface MapColors {
  land: string
  border: string
  dot: string
  dot_stroke: string
  label: string
  label_halo: string
  dict_label: string
  highlight: string
}

export const SWATCH_KEYS: (keyof MapColors)[] = ['land', 'border', 'dot', 'dot_stroke', 'label', 'label_halo', 'dict_label', 'highlight']

export function read_map_colors(swatch_container: HTMLElement): MapColors {
  const colors = {} as MapColors
  for (const key of SWATCH_KEYS) {
    const swatch = swatch_container.querySelector<HTMLElement>(`[data-swatch="${key}"]`)
    colors[key] = swatch ? getComputedStyle(swatch).backgroundColor : '#888'
  }
  return colors
}
