import QRCode, { type QRCodeErrorCorrectionLevel } from "qrcode"
import { inRoundedRect, insideTdcMark, type Mono, mono, TDC_MARK } from "@/lib/label-bitmap"

/**
 * The sticker QR in TDC's look, as 1-bit printer dots: round dots, rounded
 * corner squares and the TDC wordmark in the middle. Black only — the label is
 * thermal paper. The same bitmap goes to USB, Smooth Print (as an image in the
 * `.lbx`) and the on-screen preview, so what staff see is what prints.
 *
 * What keeps it scannable:
 * - The wordmark's hole is ~8% of the code, well inside what error
 *   correction Q (25%) or H (30%) recovers. Checked with ZXing (the app's
 *   own scanner): it reads as well as the plain square code when blurred.
 * - Versions 7 and up put an alignment square in the dead centre, under the
 *   wordmark. So stay at version 6 or below, and leave the hole out when the
 *   data does not fit.
 * - Fewer modules means bigger dots, which matters more than spare error
 *   correction: take the smallest grid that holds the data at Q, then the most
 *   error correction that grid has room for.
 * - Whole dots per module, and the hole never covers a function pattern.
 */

/** Keep ~2 mm inside the 38 mm edge so the code has a quiet zone on the label. */
export const STICKER_QR_MAX_DOTS = 372

/** Last version without a centre alignment square. */
const MAX_VERSION_WITH_HOLE = 6
const ECC_LEVELS: QRCodeErrorCorrectionLevel[] = ["H", "Q", "M"]

/** The hole for the wordmark, in modules; the mark leaves one module free all round. */
const HOLE = { width: 19, height: 7 }
/** Thermal dots bleed a little, so the dots stay clear of each other. */
const DOT_RADIUS = 0.42

function encode(data: string, errorCorrectionLevel: QRCodeErrorCorrectionLevel) {
  // `qrcode` splits the string into the cheapest run of segments: the capitals
  // and digits after `prt_` / `lgn_` go in compact alphanumeric mode, the rest as
  // UTF-8 bytes. That keeps the login link (61 chars) at 37 × 37 instead of 41 × 41.
  return QRCode.create(data, { errorCorrectionLevel })
}

function pickCode(data: string, wordmark: boolean) {
  if (!wordmark) {
    // No hole to make room for: the smallest grid, with the most error correction it holds.
    const smallest = encode(data, "L").version
    for (const level of ECC_LEVELS) {
      const code = encode(data, level)
      if (code.version === smallest) return { code, hole: false }
    }
    return { code: encode(data, "L"), hole: false }
  }
  // Q (25%) covers the hole (~8–10% of the code) with room to spare.
  const smallest = encode(data, "Q").version
  if (smallest > MAX_VERSION_WITH_HOLE) return { code: encode(data, "M"), hole: false }
  for (const level of ECC_LEVELS) {
    const code = encode(data, level)
    if (code.version === smallest) return { code, hole: true }
  }
  return { code: encode(data, "Q"), hole: true }
}

/** Thinner than this and thermal dots blur into each other; phones stop reading it. */
const MIN_DOTS_PER_MODULE = 4

/**
 * Grid `labelQr` gives `data`: modules per side and printer dots per module.
 * `null` when it does not fit in `maxDots` legibly.
 */
export function labelQrGrid(
  data: string,
  { maxDots = STICKER_QR_MAX_DOTS, wordmark = true }: { maxDots?: number; wordmark?: boolean } = {},
): { modules: number; dotsPerModule: number } | null {
  let modules: number
  try {
    modules = pickCode(data, wordmark).code.modules.size
  } catch {
    // More than a QR code holds.
    return null
  }
  const dotsPerModule = Math.floor(maxDots / modules)
  return dotsPerModule >= MIN_DOTS_PER_MODULE ? { modules, dotsPerModule } : null
}

/** Square `Mono` of `modules × cell` dots, no quiet zone (the label's white is the margin). */
export function labelQr(
  data: string,
  {
    maxDots = STICKER_QR_MAX_DOTS,
    // Off for small codes (the badge), where the hole would eat too much of the code.
    wordmark = true,
  }: { maxDots?: number; wordmark?: boolean } = {},
): Mono {
  const picked = pickCode(data, wordmark)
  const { modules } = picked.code
  const count = modules.size
  const cell = Math.floor(maxDots / count)
  const size = count * cell
  const out = mono(size, size)

  const hole = {
    x: Math.floor((count - HOLE.width) / 2),
    y: Math.floor((count - HOLE.height) / 2),
  }
  const inHole = (col: number, row: number) =>
    col >= hole.x && col < hole.x + HOLE.width && row >= hole.y && row < hole.y + HOLE.height
  let useHole = picked.hole
  for (let row = hole.y; useHole && row < hole.y + HOLE.height; row++) {
    for (let col = hole.x; col < hole.x + HOLE.width; col++) {
      if (modules.isReserved(row, col)) useHole = false
    }
  }

  const corners: [number, number][] = [
    [0, 0],
    [count - 7, 0],
    [0, count - 7],
  ]
  const cornerAt = (col: number, row: number) =>
    corners.find(([cx, cy]) => col >= cx && col < cx + 7 && row >= cy && row < cy + 7)

  const mark = {
    width: (HOLE.width - 2) * cell,
    height: ((HOLE.width - 2) * cell * TDC_MARK.height) / TDC_MARK.width,
  }
  const markLeft = (hole.x + 1) * cell
  const markTop = hole.y * cell + (HOLE.height * cell - mark.height) / 2

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // Pixel centre, in modules.
      const u = (px + 0.5) / cell
      const v = (py + 0.5) / cell
      const col = Math.floor(u)
      const row = Math.floor(v)
      const corner = cornerAt(col, row)
      let black: boolean
      if (corner) {
        const x = u - corner[0]
        const y = v - corner[1]
        // A 7 × 7 ring one module thick and a solid 3 × 3 centre, both rounded.
        black =
          (inRoundedRect(x, y, [0, 0, 7, 7], 2) && !inRoundedRect(x, y, [1, 1, 6, 6], 1.1)) ||
          inRoundedRect(x, y, [2, 2, 5, 5], 0.9)
      } else if (useHole && inHole(col, row)) {
        const mx = ((px + 0.5 - markLeft) / mark.width) * TDC_MARK.width
        const my = ((py + 0.5 - markTop) / mark.height) * TDC_MARK.height
        black =
          mx >= 0 &&
          mx <= TDC_MARK.width &&
          my >= 0 &&
          my <= TDC_MARK.height &&
          insideTdcMark(mx, my)
      } else {
        black =
          Boolean(modules.get(row, col)) && Math.hypot(u - col - 0.5, v - row - 0.5) <= DOT_RADIUS
      }
      if (black) out.black[py * size + px] = 1
    }
  }
  return out
}
