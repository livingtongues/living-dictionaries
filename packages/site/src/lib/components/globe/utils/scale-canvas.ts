export function scale_canvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  center = false,
) {
  const device_pixel_ratio = window.devicePixelRatio || 1

  canvas.width = width * device_pixel_ratio
  canvas.height = height * device_pixel_ratio

  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'

  context.scale(device_pixel_ratio, device_pixel_ratio)

  if (center) {
    context.translate(width / 2, height / 2)
  }
}
