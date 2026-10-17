/**
 * 1-bit label art in printer dots (300 dpi), shared by the browser (sticker QR)
 * and scripts/build-sticker-templates.ts (duck, TDC mark).
 */

/** 1-bit image, 1 = black, row-major. */
export type Mono = { width: number; height: number; black: Uint8Array }

export function mono(width: number, height: number): Mono {
  return { width, height, black: new Uint8Array(width * height) }
}

/** Inside a rectangle with some corners rounded (TL, TR, BR, BL). */
export function inRoundedRect(
  x: number,
  y: number,
  [x0, y0, x1, y1]: [number, number, number, number],
  radius: number,
  [tl, tr, br, bl]: [boolean, boolean, boolean, boolean] = [true, true, true, true],
) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const corner = (cx: number, cy: number) => Math.hypot(x - cx, y - cy) <= radius
  if (tl && x < x0 + radius && y < y0 + radius) return corner(x0 + radius, y0 + radius)
  if (tr && x > x1 - radius && y < y0 + radius) return corner(x1 - radius, y0 + radius)
  if (br && x > x1 - radius && y > y1 - radius) return corner(x1 - radius, y1 - radius)
  if (bl && x < x0 + radius && y > y1 - radius) return corner(x0 + radius, y1 - radius)
  return true
}

const MARK_GAP = 7.28

/** TDC wordmark (tdc-logo.tsx) in its own units: 52 tall. */
export const TDC_MARK = { width: 40 + MARK_GAP + 154 + MARK_GAP + 40, height: 52 } as const

/** Whether (x, y), in `TDC_MARK` units, is on the wordmark. */
export function insideTdcMark(x: number, y: number) {
  const d = 40 + MARK_GAP
  const c = 40 + MARK_GAP + 154 + MARK_GAP
  return (
    // T
    (x >= 10.1 && x <= 29.72 && y <= 52) ||
    (x <= 39.81 && y <= 17.33) ||
    // D (pill on the right)
    inRoundedRect(x, y, [d, 0, d + 153.73, 52], 17.33, [false, true, true, false]) ||
    // C, with the notch on the right
    (inRoundedRect(x, y, [c, 0, c + 39.81, 52], 17.33, [true, false, false, true]) &&
      !(x >= c + 19.91 && y >= 17.33 && y <= 34.67))
  )
}

/**
 * Reader image → paper orientation (reader top → paper right, 90° clockwise),
 * as the 32-bit bottom-up BMP that P-touch writes into an `.lbx`.
 */
export function paperBmp(reader: Mono): Uint8Array<ArrayBuffer> {
  const width = reader.height
  const height = reader.width
  const header = 54
  const bytes = new Uint8Array(header + width * height * 4).fill(0xff)
  const view = new DataView(bytes.buffer)
  bytes[0] = 0x42 // B
  bytes[1] = 0x4d // M
  view.setUint32(2, bytes.length, true)
  view.setUint32(6, 0, true)
  view.setUint32(10, header, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 32, true)
  view.setUint32(30, 0, true)
  view.setUint32(34, width * height * 4, true)
  view.setInt32(38, 3780, true) // 96 dpi
  view.setInt32(42, 3780, true)
  view.setUint32(46, 0, true)
  view.setUint32(50, 0, true)
  for (let y = 0; y < height; y++) {
    const row = header + (height - 1 - y) * width * 4
    for (let x = 0; x < width; x++) {
      // Clockwise: paper (x, y) ← reader (y, readerHeight - 1 - x).
      if (reader.black[(reader.height - 1 - x) * reader.width + y]) {
        bytes.fill(0, row + x * 4, row + x * 4 + 3)
      }
    }
  }
  return bytes
}
