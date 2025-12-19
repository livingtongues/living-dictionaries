<script lang="ts">
  import { QrCode, QrCodeEcc } from './qrcodegen'

  interface Props {
    value: string;
    pixelsPerModule?: number;
    errorCorrection?: 'low' | 'medium' | 'quartile' | 'high';
    bgColor?: string;
    fgColor?: string;
  }

  let {
    value,
    pixelsPerModule = 4,
    errorCorrection = 'high',
    bgColor = '#FFFFFF',
    fgColor = '#000000'
  }: Props = $props();

  let ecl = $derived((() => {
    if (errorCorrection === 'high') return QrCodeEcc.HIGH
    else if (errorCorrection === 'quartile') return QrCodeEcc.QUARTILE
    else if (errorCorrection === 'medium') return QrCodeEcc.MEDIUM
    return QrCodeEcc.LOW
  })())
  let qr = $derived(QrCode.encodeText(value, ecl))

  let fgPath = $derived((() => {
    const parts: string[] = []
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.getModule(x, y)) parts.push(`M${x},${y}h1v1h-1z`)
      }
    }
    return parts.join(' ')
  })())
</script>

<svg height={qr.size * pixelsPerModule} width={qr.size * pixelsPerModule} viewBox={`0 0 ${qr.size} ${qr.size}`} stroke="none">
  <rect width="100%" height="100%" fill={bgColor} />
  <path fill={fgColor} d={fgPath} shape-rendering="crispEdges" />
</svg>
