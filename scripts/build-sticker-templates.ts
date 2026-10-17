/**
 * Generate rotated (landscape) printer + stasjon sticker templates for DK-11208.
 *
 * Paper stays portrait (107.7 × 255.1 pt) like badge.lbx; the label is read with
 * the paper's right edge as "up". Layout is written in reader coords (u right,
 * v down, 255.1 × 107.7) and mapped to paper coords. Text objects rotate with
 * angle=90; art is pre-rotated bitmaps at angle=0.
 *
 *   pnpm build:stickers
 *
 * Reads the QR object from the current printer.lbx, so it is safe to re-run over
 * its own output.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { inflateSync } from "node:zlib"
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import { insideTdcMark, type Mono, mono, paperBmp, TDC_MARK } from "../src/lib/label-bitmap"

const REPO = process.argv[2] ?? "."
const OUT = process.argv[3] ?? join(REPO, "public/templates")
const PAPER_W = 107.7
const PX_PER_PT = 300 / 72 // QL-820NWB is 300 dpi

const src = unzipSync(readFileSync(join(REPO, "public/templates/printer.lbx")))
const BASE_XML = strFromU8(src["label.xml"]!)
const PROP_XML = strFromU8(src["prop.xml"]!)
const [HEAD, rest] = splitOnce(BASE_XML, "<pt:objects>")
const TAIL = splitOnce(rest, "</pt:objects>")[1]
const QR_XML = BASE_XML.match(/<barcode:barcode>.*<\/barcode:barcode>/)![0]

function splitOnce(text: string, separator: string): [string, string] {
  const at = text.indexOf(separator)
  if (at < 0) throw new Error(`missing ${separator}`)
  return [text.slice(0, at), text.slice(at + separator.length)]
}

/** Reader box → paper objectStyle box (x, y, width, height). */
function paperBox(u: number, v: number, w: number, h: number) {
  return [PAPER_W - (v + h), u, h, w] as const
}

/** One decimal, always — how P-touch Editor writes lengths. */
function f(n: number) {
  return `${(Math.round(n * 10) / 10).toFixed(1)}pt`
}

function escapeXml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

type Text = {
  name: string
  u: number
  v: number
  w: number
  h: number
  data: string
  size: number
  bold?: boolean
  align?: "LEFT" | "RIGHT"
}

function textObj({ name, u, v, w, h, data, size, bold = false, align = "LEFT" }: Text) {
  const [x, y, pw, ph] = paperBox(u, v, w, h)
  const weight = bold ? 700 : 400
  const font =
    `<text:ptFontInfo><text:logFont name="Helsinki" width="0" italic="false" weight="${weight}" ` +
    `charSet="0" pitchAndFamily="34"/><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" ` +
    `size="${size}pt" orgSize="${size}pt" textColor="#000000" textPrintColorNumber="1"/></text:ptFontInfo>`
  return (
    `<text:text><pt:objectStyle x="${f(x)}" y="${f(y)}" width="${f(pw)}" height="${f(ph)}" ` +
    'backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="90" anchor="TOPLEFT" flip="NONE">' +
    '<pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/>' +
    '<pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/>' +
    `<pt:expanded objectName="${name}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" ` +
    'templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle>' +
    font +
    '<text:textControl control="FIXEDFRAME" clipFrame="false" aspectNormal="true" shrink="true" autoLF="false" avoidImage="false"/>' +
    `<text:textAlign horizontalAlignment="${align}" verticalAlignment="CENTER" inLineAlignment="BASELINE"/>` +
    `<text:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="0" orgPoint="${size}pt" combinedChars="false"/>` +
    `<pt:data>${escapeXml(data)}</pt:data>` +
    `<text:stringItem charLen="${data.length}">${font}</text:stringItem></text:text>`
  )
}

function imageObj(name: string, file: string, u: number, v: number, w: number, h: number) {
  // angle=0 with a pre-rotated bitmap: no guessing how Smooth Print rotates images.
  const [x, y, pw, ph] = paperBox(u, v, w, h)
  const box = `x="${f(x)}" y="${f(y)}" width="${f(pw)}" height="${f(ph)}"`
  return (
    `<image:image><pt:objectStyle ${box} backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" ` +
    'angle="0" anchor="TOPLEFT" flip="NONE">' +
    '<pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/>' +
    '<pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/>' +
    `<pt:expanded objectName="${name}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" ` +
    'templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle>' +
    `<image:imageStyle originalName="${name.toLowerCase()}.png" alignInText="NONE" firstMerge="true" IpName="" fileName="${file}">` +
    '<image:transparent flag="false" color="#FFFFFF"/>' +
    '<image:trimming flag="false" shape="RECTANGLE" trimOrgX="0pt" trimOrgY="0pt" trimOrgWidth="0pt" trimOrgHeight="0pt"/>' +
    `<image:orgPos ${box}/>` +
    '<image:effect effect="MONO" brightness="50" contrast="50" photoIndex="4"/>' +
    '<image:mono operationKind="ERRORDIFFUSION" reverse="0" ditherKind="MESH" threshold="128" gamma="100" ' +
    'ditherEdge="0" rgbconvProportionRed="30" rgbconvProportionGreen="59" rgbconvProportionBlue="11" ' +
    'rgbconvProportionReversed="0"/></image:imageStyle></image:image>'
  )
}

function qrObj() {
  // Known-good QR frame from printer.lbx (paper x=1 centers it on the 38 mm edge).
  // Reader: top-left of the label, full height.
  return QR_XML.replace('y="30.0pt"', 'y="8.4pt"')
}

// ---- bitmaps ----------------------------------------------------------------

/** 8-bit RGBA, non-interlaced PNG (what public/badge ships). */
function decodePng(bytes: Buffer) {
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (bytes[24] !== 8 || bytes[25] !== 6 || bytes[28] !== 0) throw new Error("png_not_rgba8")
  const idat: Buffer[] = []
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at)
    if (bytes.toString("latin1", at + 4, at + 8) === "IDAT") {
      idat.push(bytes.subarray(at + 8, at + 8 + length))
    }
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const rgba = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? rgba[y * stride + i - 4]! : 0
      const up = y > 0 ? rgba[(y - 1) * stride + i]! : 0
      const upLeft = y > 0 && i >= 4 ? rgba[(y - 1) * stride + i - 4]! : 0
      let predictor = 0
      if (filter === 1) predictor = left
      else if (filter === 2) predictor = up
      else if (filter === 3) predictor = (left + up) >> 1
      else if (filter === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
      }
      rgba[y * stride + i] = (line[i]! + predictor) & 0xff
    }
  }
  return {
    width,
    pixel: (x: number, y: number) => rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4),
  }
}

/** 12×12 pixel duck from 8bit-duck-dither.png, cells filled with an ordered dither. */
function duckImage(cellsPx: number, dot = 2): Mono {
  const png = decodePng(readFileSync(join(REPO, "public/badge/8bit-duck-dither.png")))
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ]
  const size = 12 * cellsPx
  const out = mono(size, size)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const [r, , , a] = png.pixel(
        Math.floor(px / cellsPx) * 10 + 5,
        Math.floor(py / cellsPx) * 10 + 5,
      )
      if (a! < 128) continue
      const ink = 1 - (r! / 255) * 0.8 // darken so the light body still reads on thermal paper
      if (ink * 16 > bayer[Math.floor(py / dot) % 4]![Math.floor(px / dot) % 4]! + 0.5) {
        out.black[py * size + px] = 1
      }
    }
  }
  return out
}

/** TDC wordmark (tdc-logo.tsx) in black, 4×4 supersampled then thresholded. */
function tdcMark(heightPx: number): Mono {
  const inside = insideTdcMark

  const unitsPerPx = TDC_MARK.height / heightPx
  const width = Math.floor(TDC_MARK.width / unitsPerPx)
  const out = mono(width, heightPx)
  const ss = 4
  for (let py = 0; py < heightPx; py++) {
    for (let px = 0; px < width; px++) {
      let hits = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) * unitsPerPx
          const y = (py + (sy + 0.5) / ss) * unitsPerPx
          if (inside(x, y)) hits++
        }
      }
      if (hits * 2 > ss * ss) out.black[py * width + px] = 1
    }
  }
  return out
}

function ptSize(img: Mono) {
  return [img.width / PX_PER_PT, img.height / PX_PER_PT] as const
}

// ---- layouts ----------------------------------------------------------------

const PANEL_U = 116.0
const PANEL_R = 244.0
const PANEL_W = PANEL_R - PANEL_U

const SITE = "innsjekk.trondheimdc.no"

type Placed = { name: string; img: Mono; u: number; v: number; w: number; h: number }

/** Duck in the lower-left of the panel, TDC mark in the lower-right corner, bottoms aligned. */
function bottomRow(duck: Mono, mark: Mono, bottom: number): Placed[] {
  const [dw, dh] = ptSize(duck)
  const [mw, mh] = ptSize(mark)
  return [
    { name: "DUCK", img: duck, u: PANEL_U, v: bottom - dh, w: dw, h: dh },
    { name: "TDC", img: mark, u: PANEL_R - mw, v: bottom - mh, w: mw, h: mh },
  ]
}

/** The URL right-aligned just above the TDC mark. */
function siteAbove(mark: Mono, bottom: number, size: number): Text {
  const [, mh] = ptSize(mark)
  return {
    name: "SITE",
    u: PANEL_U,
    v: bottom - mh - 11,
    w: PANEL_W,
    h: 9,
    data: SITE,
    size,
    align: "RIGHT",
  }
}

function build(kind: "printer" | "stasjon") {
  const objs = [qrObj()]
  const files: Record<string, Uint8Array> = {}

  const duck = duckImage(16) // 192 px = 46 pt, same on both stickers
  const mark = tdcMark(58) // ~14 pt tall
  const title = kind === "printer" ? "Koble til · Printer 1" : "Logg inn · Printer 1"
  const texts: Text[] = [
    ...(kind === "stasjon"
      ? [
          {
            name: "MODEL",
            u: 150,
            v: 5,
            w: PANEL_R - 150,
            h: 9,
            data: "Model QL-820NWBc",
            size: 6.5,
            bold: true,
            align: "RIGHT",
          } satisfies Text,
        ]
      : []),
    { name: "NAME", u: PANEL_U, v: 17, w: PANEL_W, h: 22, data: title, size: 15, bold: true },
  ]
  const images = bottomRow(duck, mark, 100)
  texts.push(siteAbove(mark, 100, 6.5))

  images.forEach(({ name, img, u, v, w, h }, i) => {
    const file = `Object${i}.bmp`
    files[file] = paperBmp(img)
    objs.unshift(imageObj(name, file, u, v, w, h))
  })
  for (const text of texts) objs.push(textObj(text))

  const xml = `${HEAD}<pt:objects>${objs.join("")}</pt:objects>${TAIL}`
  const docTitle = kind === "printer" ? "TDC printer sticker" : "TDC stasjon sticker"
  const prop = PROP_XML.replace(
    /<dc:title>.*?<\/dc:title>/,
    `<dc:title>${docTitle}</dc:title>`,
  ).replace(
    /<dc:description>.*?<\/dc:description>/,
    "<dc:description>DK-11208 landscape: QR left, name right</dc:description>",
  )

  const lbx = zipSync(
    { "label.xml": strToU8(xml), "prop.xml": strToU8(prop), ...files },
    { level: 6 },
  )
  writeFileSync(join(OUT, `${kind}.lbx`), lbx)
}

for (const kind of ["printer", "stasjon"] as const) build(kind)
console.log("ok")
