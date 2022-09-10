export function randomColor(lightness = 70) {
  const hue = Math.floor(Math.random() * 360);
  const l = lightness > 0 && lightness < 101 ? lightness : 70;
  return `hsl(${hue}, 100%, ${l}%)`;
}
