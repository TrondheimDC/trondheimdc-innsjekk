import {
  BADGE_QR_FRAME,
  BADGE_QR_LINE2_FONT,
  BADGE_QR_LINE2_FRAME,
  BADGE_QR_LINE3_FONT,
  BADGE_QR_LINE3_FRAME,
  BADGE_QR_MAX_DOTS,
} from "@/lib/badge-qr-layout"
import type { Mono } from "@/lib/label-bitmap"
import { labelQr } from "@/lib/label-qr"

/**
 * Draws DK-11208 labels (badge, printer stickers) in the browser for USB printing (PC/Mac).
 *
 * Phones print `public/templates/*.lbx` through Smooth Print. Over USB the
 * printer only takes raster dots, so this redraws the same layout. Badge frames
 * below are copied from the badge `label.xml` — change them together with the
 * LBX. Printer stickers are drawn from their `.lbx` directly (`renderSticker`).
 */

/** QL-820NWB head resolution. */
const DPI = 300

/** Printable area of DK-11208 at 300 dpi: 413 dots across the head, 991 along the feed. */
export const BADGE_DOTS = { across: 413, along: 991 } as const

/** LBX page is portrait 107.7 × 255.1 pt with these margins; the printable area starts here. */
const PAGE_MARGIN_PT = { left: 4.3, top: 8.4 }

type PtRect = { x: number; y: number; width: number; height: number }
type DotRect = PtRect

/** Portrait LBX frames (pt). Text uses angle="90", so it runs along the 90 mm edge. */
const NAME_FRAME: PtRect = { x: 45.8, y: 8.4, width: 48, height: 238.2 }
const LINE2_FRAME: PtRect = { x: 13.8, y: 8.4, width: 26, height: 238.2 }
const DUCK_FRAME: PtRect = { x: 6.3, y: 224.6, width: 20, height: 20 }

const NAME_FONT = { sizePt: 32, weight: 700 }
const LINE2_FONT = { sizePt: 16, weight: 400 }

/** P-touch "Helsinki" is Brother's Helvetica; use whatever Helvetica/Arial the desktop has. */
const FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif'

type DuckStyle = "dither" | "mono"

/** Keyed by the `.lbx` filename phones use, so both paths pick the same variant. */
const TEMPLATE_DUCK: Record<string, DuckStyle | null> = {
  "badge.lbx": "dither",
  "badge-duck-mono.lbx": "mono",
  "badge-plain.lbx": null,
}

const DUCK_ASSET: Record<DuckStyle, string> = {
  dither: "/badge/8bit-duck-dither.png",
  mono: "/badge/8bit-duck-mono.png",
}

function ptToDots(pt: number): number {
  return (pt * DPI) / 72
}

/**
 * Portrait LBX frame → rect on the landscape canvas (how the badge is read).
 * Reading the badge turns the portrait page a quarter turn counter-clockwise:
 * the NAME frame (right side of the page) ends up on top, the duck bottom-right.
 */
function landscapeRect(frame: PtRect): DotRect {
  const px = ptToDots(frame.x - PAGE_MARGIN_PT.left)
  const py = ptToDots(frame.y - PAGE_MARGIN_PT.top)
  const pw = ptToDots(frame.width)
  const ph = ptToDots(frame.height)
  return { x: py, y: BADGE_DOTS.across - px - pw, width: ph, height: pw }
}

function assetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""
  return `${base}${path}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`image load failed: ${src}`))
    image.src = src
  })
}

type TextAlign = "LEFT" | "CENTER" | "RIGHT"

/** Single line, shrunk to fit — like the LBX `FIXEDFRAME` + `shrink="true"`. */
function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: DotRect,
  font: { sizePt: number; weight: number },
  align: TextAlign = "CENTER",
) {
  const value = text.trim()
  if (!value) return
  let size = ptToDots(font.sizePt)
  ctx.font = `${font.weight} ${size}px ${FONT_FAMILY}`
  const measured = ctx.measureText(value).width
  if (measured > rect.width) {
    size = (size * rect.width) / measured
    ctx.font = `${font.weight} ${size}px ${FONT_FAMILY}`
  }
  const metrics = ctx.measureText(value)
  const ascent = metrics.fontBoundingBoxAscent ?? size * 0.8
  const descent = metrics.fontBoundingBoxDescent ?? size * 0.2
  const x =
    align === "LEFT" ? rect.x : align === "RIGHT" ? rect.x + rect.width : rect.x + rect.width / 2
  ctx.textAlign = align === "LEFT" ? "left" : align === "RIGHT" ? "right" : "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillText(value, x, rect.y + rect.height / 2 + (ascent - descent) / 2)
}

/** 8×8 Bayer thresholds for the duck's grey cells (P-touch uses a mesh dither here). */
const BAYER_8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
]

function luminance(data: Uint8ClampedArray, i: number): number {
  // Transparent pixels are the white label.
  const alpha = data[i + 3]! / 255
  const lum = 0.3 * data[i]! + 0.59 * data[i + 1]! + 0.11 * data[i + 2]!
  return lum * alpha + 255 * (1 - alpha)
}

async function drawDuck(ctx: CanvasRenderingContext2D, style: DuckStyle) {
  const image = await loadImage(assetUrl(DUCK_ASSET[style]))
  const rect = landscapeRect(DUCK_FRAME)
  const x = Math.round(rect.x)
  const y = Math.round(rect.y)
  const size = Math.round(rect.width)

  const scratch = document.createElement("canvas")
  scratch.width = size
  scratch.height = size
  const sctx = scratch.getContext("2d")
  if (!sctx) throw new Error("canvas unavailable")
  // Pixel art: keep the cells crisp.
  sctx.imageSmoothingEnabled = false
  sctx.drawImage(image, 0, 0, size, size)
  const pixels = sctx.getImageData(0, 0, size, size)

  const target = ctx.getImageData(x, y, size, size)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = (row * size + col) * 4
      const lum = luminance(pixels.data, i)
      const threshold =
        style === "mono" ? 128 : ((BAYER_8[(row % 8) * 8 + (col % 8)]! + 0.5) / 64) * 255
      if (lum < threshold) {
        target.data[i] = 0
        target.data[i + 1] = 0
        target.data[i + 2] = 0
        target.data[i + 3] = 255
      }
    }
  }
  ctx.putImageData(target, x, y)
}

/** Snap anti-aliased text to pure black/white so the printer's dither leaves it alone. */
function threshold(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height)
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    const value = luminance(data, i) < 128 ? 0 : 255
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
}

function blankLabel(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("canvas unavailable")
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = "#000"
  return { canvas, ctx }
}

export type BadgeInput = {
  /** Null while the name is not typed in yet (correction preview); prints nothing there. */
  name: string | null
  line2: string
  /** `.lbx` filename from `PRINT_SAMPLES`; defaults to the production badge. */
  template?: string
  /** QR content: puts the code bottom-left and stacks line 2 over `line3` (`badge-qr-layout`). */
  qr?: string | null
  line3?: string
}

function drawMono(ctx: CanvasRenderingContext2D, image: Mono, left: number, top: number) {
  for (let row = 0; row < image.height; row++) {
    for (let col = 0; col < image.width; col++) {
      if (image.black[row * image.width + col]) ctx.fillRect(left + col, top + row, 1, 1)
    }
  }
}

/** Landscape 991 × 413 canvas: exactly the dots that print, the way the badge is read. */
export async function renderBadge(input: BadgeInput): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = blankLabel(BADGE_DOTS.along, BADGE_DOTS.across)
  await document.fonts.ready
  if (input.name) drawFittedText(ctx, input.name, landscapeRect(NAME_FRAME), NAME_FONT)
  if (input.qr) {
    drawFittedText(ctx, input.line2, landscapeRect(BADGE_QR_LINE2_FRAME), BADGE_QR_LINE2_FONT)
    drawFittedText(ctx, input.line3 ?? "", landscapeRect(BADGE_QR_LINE3_FRAME), BADGE_QR_LINE3_FONT)
  } else {
    drawFittedText(ctx, input.line2, landscapeRect(LINE2_FRAME), LINE2_FONT)
  }
  threshold(ctx, canvas.width, canvas.height)

  if (input.qr) {
    const frame = landscapeRect(BADGE_QR_FRAME)
    const qr = labelQr(input.qr, { maxDots: BADGE_QR_MAX_DOTS, wordmark: false })
    drawMono(
      ctx,
      qr,
      Math.round(frame.x + (frame.width - qr.width) / 2),
      Math.round(frame.y + (frame.height - qr.height) / 2),
    )
  }

  const duck = TEMPLATE_DUCK[input.template ?? "badge.lbx"] ?? null
  if (duck) await drawDuck(ctx, duck)
  return canvas
}

/**
 * Portrait 413 × 991 image for the print head (x across the head, y along the feed) —
 * the LBX page orientation. Undo the reading turn: rotate the landscape canvas clockwise.
 */
export function badgePrintImage(landscape: HTMLCanvasElement): {
  width: number
  height: number
  data: Uint8Array
} {
  const ctx = landscape.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("canvas unavailable")
  const source = ctx.getImageData(0, 0, landscape.width, landscape.height)
  const width = landscape.height
  const height = landscape.width
  const out = { width, height, data: new Uint8Array(width * height * 4) }
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const from = ((width - 1 - px) * source.width + py) * 4
      const to = (py * width + px) * 4
      out.data[to] = source.data[from]!
      out.data[to + 1] = source.data[from + 1]!
      out.data[to + 2] = source.data[from + 2]!
      out.data[to + 3] = 255
    }
  }
  return out
}

/** Reads the `pt`-suffixed attributes of an LBX `pt:objectStyle`. */
function objectFrame(element: Element): PtRect {
  const style = element.getElementsByTagName("pt:objectStyle")[0]
  const pt = (name: string) => Number.parseFloat(style?.getAttribute(name) ?? "0")
  return { x: pt("x"), y: pt("y"), width: pt("width"), height: pt("height") }
}

/** 32-bit BMP (what P-touch and scripts/build-sticker-templates.ts write) → 1-bit mask. */
function decodeBmp(bytes: Uint8Array): { width: number; height: number; black: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const offset = view.getUint32(10, true)
  const width = view.getInt32(18, true)
  const rawHeight = view.getInt32(22, true)
  if (view.getUint16(28, true) !== 32) throw new Error("lbx_bmp_not_32bit")
  const height = Math.abs(rawHeight)
  const black = new Uint8Array(width * height)
  for (let row = 0; row < height; row++) {
    // Positive height: rows are stored bottom-up.
    const src = offset + (rawHeight > 0 ? height - 1 - row : row) * width * 4
    for (let col = 0; col < width; col++) {
      const i = src + col * 4
      const lum = 0.11 * bytes[i]! + 0.59 * bytes[i + 1]! + 0.3 * bytes[i + 2]!
      black[row * width + col] = lum < 128 ? 1 : 0
    }
  }
  return { width, height, black }
}

/**
 * Sticker art is pre-rotated to the portrait page (angle="0"). Put its pixels
 * back into reading orientation: page x runs up the landscape canvas.
 */
function drawPageBitmap(
  ctx: CanvasRenderingContext2D,
  bitmap: ReturnType<typeof decodeBmp>,
  frame: PtRect,
) {
  const rect = landscapeRect(frame)
  const scaleX = bitmap.width / rect.height
  const scaleY = bitmap.height / rect.width
  const left = Math.round(rect.x)
  const bottom = Math.round(rect.y + rect.height)
  for (let u = 0; u < Math.round(rect.width); u++) {
    for (let v = 0; v < Math.round(rect.height); v++) {
      const col = Math.min(bitmap.width - 1, Math.floor(v * scaleX))
      const row = Math.min(bitmap.height - 1, Math.floor(u * scaleY))
      if (bitmap.black[row * bitmap.width + col]) ctx.fillRect(left + u, bottom - 1 - v, 1, 1)
    }
  }
}

/**
 * Landscape printer sticker (`printer.lbx` / `stasjon.lbx`), drawn from the
 * template itself so USB and Smooth Print cannot drift: its text frames
 * (angle="90"; `NAME` gets `name`), its bitmaps and its QR frame, which gets
 * the TDC QR (`labelQr`).
 */
export async function renderSticker(input: {
  name: string
  qr: string
  templateFile: string
}): Promise<HTMLCanvasElement> {
  const { unzipSync, strFromU8 } = await import("fflate")
  const response = await fetch(assetUrl(`/templates/${input.templateFile}`), { cache: "no-store" })
  if (!response.ok) throw new Error("template fetch failed")
  const entries = unzipSync(new Uint8Array(await response.arrayBuffer()))
  const labelXml = entries["label.xml"]
  if (!labelXml) throw new Error("lbx_entry_not_found")
  const doc = new DOMParser().parseFromString(strFromU8(labelXml), "application/xml")

  const { canvas, ctx } = blankLabel(BADGE_DOTS.along, BADGE_DOTS.across)
  await document.fonts.ready

  for (const text of Array.from(doc.getElementsByTagName("text:text"))) {
    const objectName = text.getElementsByTagName("pt:expanded")[0]?.getAttribute("objectName")
    const data = text.getElementsByTagName("pt:data")[0]?.textContent ?? ""
    const fontExt = text.getElementsByTagName("text:fontExt")[0]
    const logFont = text.getElementsByTagName("text:logFont")[0]
    const align = text
      .getElementsByTagName("text:textAlign")[0]
      ?.getAttribute("horizontalAlignment")
    drawFittedText(
      ctx,
      objectName === "NAME" ? input.name : data,
      landscapeRect(objectFrame(text)),
      {
        sizePt: Number.parseFloat(fontExt?.getAttribute("size") ?? "10"),
        weight: Number(logFont?.getAttribute("weight") ?? 400),
      },
      align === "LEFT" || align === "RIGHT" ? align : "CENTER",
    )
  }
  threshold(ctx, canvas.width, canvas.height)

  for (const image of Array.from(doc.getElementsByTagName("image:image"))) {
    const file = image.getElementsByTagName("image:imageStyle")[0]?.getAttribute("fileName")
    const bytes = file ? entries[file] : undefined
    if (bytes) drawPageBitmap(ctx, decodeBmp(bytes), objectFrame(image))
  }

  const barcode = doc.getElementsByTagName("barcode:barcode")[0]
  if (barcode) {
    const frame = landscapeRect(objectFrame(barcode))
    const qr = labelQr(input.qr)
    // Horizontally where the template puts it; vertically centred on the 38 mm edge
    // (the template's frame carries a Smooth Print offset that raster does not need).
    drawMono(
      ctx,
      qr,
      Math.round(frame.x + (frame.width - qr.width) / 2),
      Math.round((BADGE_DOTS.across - qr.height) / 2),
    )
  }
  return canvas
}
