import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import { paperBmp } from "@/lib/label-bitmap"
import { labelQr } from "@/lib/label-qr"

/**
 * Brother's QR barcode object can only draw plain square modules, so before
 * printing through Smooth Print the sticker template's QR object is swapped for
 * an image of the TDC QR (`labelQr`) — the same dots USB prints. The barcode
 * object stays in the hosted `.lbx` as the frame's source of truth.
 *
 * The bitmap is exactly 300 dpi and its frame is sized to match (one dot is
 * 0.24 pt), so Smooth Print does not resample the dots.
 */

const PT_PER_DOT = 72 / 300

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function pt(value: number) {
  return `${value.toFixed(2)}pt`
}

/** Same object shape as the sticker art in scripts/build-sticker-templates.ts. */
function imageObject(file: string, x: number, y: number, size: number) {
  const box = `x="${pt(x)}" y="${pt(y)}" width="${pt(size)}" height="${pt(size)}"`
  return (
    `<image:image><pt:objectStyle ${box} backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" ` +
    'angle="0" anchor="TOPLEFT" flip="NONE">' +
    '<pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/>' +
    '<pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/>' +
    '<pt:expanded objectName="QR" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" ' +
    'templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle>' +
    `<image:imageStyle originalName="qr.png" alignInText="NONE" firstMerge="true" IpName="" fileName="${file}">` +
    '<image:transparent flag="false" color="#FFFFFF"/>' +
    '<image:trimming flag="false" shape="RECTANGLE" trimOrgX="0pt" trimOrgY="0pt" trimOrgWidth="0pt" trimOrgHeight="0pt"/>' +
    `<image:orgPos ${box}/>` +
    '<image:effect effect="MONO" brightness="50" contrast="50" photoIndex="4"/>' +
    '<image:mono operationKind="ERRORDIFFUSION" reverse="0" ditherKind="MESH" threshold="128" gamma="100" ' +
    'ditherEdge="0" rgbconvProportionRed="30" rgbconvProportionGreen="59" rgbconvProportionBlue="11" ' +
    'rgbconvProportionReversed="0"/></image:imageStyle></image:image>'
  )
}

/** Swaps the sticker template's QR object for an image of `qr` in the TDC look. */
export function withStickerQrImage(fileBase64: string, qr: string): string {
  // Keep every entry: the sticker art ships as Object*.bmp next to label.xml.
  const entries = unzipSync(base64ToBytes(fileBase64))
  const labelEntry = entries["label.xml"]
  if (!labelEntry) throw new Error("lbx_entry_not_found")
  const labelXml = strFromU8(labelEntry)

  const barcode = labelXml.match(/<barcode:barcode>[\s\S]*?<\/barcode:barcode>/)?.[0]
  const style = barcode?.match(/<pt:objectStyle[^>]*>/)?.[0]
  if (!barcode || !style) throw new Error("lbx_barcode_frame_not_found")
  const frame = (name: string) => Number(style.match(new RegExp(`\\b${name}="([\\d.]+)pt"`))?.[1])
  const [x, y, width, height] = ["x", "y", "width", "height"].map(frame) as [
    number,
    number,
    number,
    number,
  ]

  const image = labelQr(qr)
  const size = image.width * PT_PER_DOT
  let index = 0
  while (entries[`Object${index}.bmp`]) index++
  const file = `Object${index}.bmp`

  entries[file] = paperBmp(image)
  entries["label.xml"] = strToU8(
    labelXml.replace(
      barcode,
      imageObject(file, x + (width - size) / 2, y + (height - size) / 2, size),
    ),
  )
  return bytesToBase64(zipSync(entries))
}
