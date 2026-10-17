import { labelQr } from "@/lib/label-qr"

/** The template's 99 pt QR frame, in printer dots. */
const FRAME_DOTS = (99 * 300) / 72

/**
 * On-screen preview of the sticker QR: the printed dots (`labelQr`) as an SVG,
 * centred in the template's QR frame. Built without a canvas, so it renders on
 * the server too.
 */
export function stickerQrDataUrl(qrUrl: string): string {
  const qr = labelQr(qrUrl)
  const offset = (FRAME_DOTS - qr.width) / 2
  const runs: string[] = []
  for (let row = 0; row < qr.height; row++) {
    let col = 0
    while (col < qr.width) {
      if (!qr.black[row * qr.width + col]) {
        col++
        continue
      }
      const start = col
      while (col < qr.width && qr.black[row * qr.width + col]) col++
      runs.push(`M${start},${row}h${col - start}v1h${start - col}z`)
    }
  }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${FRAME_DOTS} ${FRAME_DOTS}' shape-rendering='crispEdges'>` +
    `<path transform='translate(${offset} ${offset})' fill='#0f0f0f' d='${runs.join("")}'/></svg>`
  // Only what a data: URL needs escaped; the path itself (digits, commas, letters) goes as is.
  return `data:image/svg+xml;charset=utf-8,${svg.replace(/[\s#%<>]/g, encodeURIComponent)}`
}
