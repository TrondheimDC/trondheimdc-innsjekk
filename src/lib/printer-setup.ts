import { z } from "zod"
import { type ConnectType, DEFAULT_PRINTER_MODEL } from "@/lib/print-url"

export type PrinterSetupParams = {
  /** Inventory id when the printer came from an id sticker; keeps the URL short and current. */
  id?: string
  address: string
  serial: string
  model: string
  connectType: ConnectType
}

export const printerSetupParamsSchema = z.object({
  id: z.string().optional(),
  address: z.string(),
  serial: z.string(),
  model: z.string(),
  connectType: z.enum(["BT", "WiFi"]),
})

export const printerSetupResponseSchema = z.object({ printer: printerSetupParamsSchema })

/** What a scanned setup sticker carries: an inventory id, or (older stickers) the fields. */
export type PrinterSticker = { printerId: string } | { params: PrinterSetupParams }

/**
 * Path encoded on the front sticker. Only the id: /oppsett looks up the
 * address, serial and connection type, so a printed sticker keeps working
 * when those change in the inventory.
 */
export function printerSetupPath(printerId: string): string {
  return `/oppsett?${new URLSearchParams({ printer: printerId })}`
}

/** `prt_` + body, as the `/oppsett/prt_…` route takes it. */
export const PRINTER_ID_PATTERN = /^prt_[0-9A-Z]+$/

/**
 * Link printed on the front sticker: `/oppsett/prt_…`, which redirects to
 * `printerSetupPath`. Shorter than the query form, so the QR is coarser and
 * scans more easily. Printers from before `prt_` ids keep the query form.
 */
export function printerStickerSetupPath(printerId: string): string {
  return PRINTER_ID_PATTERN.test(printerId) ? `/oppsett/${printerId}` : printerSetupPath(printerId)
}

/** Older stickers with the fields inline (`/koble`, `/oppsett?address=…`). */
export function printerSetupParamsPath(input: PrinterSetupParams): string {
  const params = new URLSearchParams({
    path: "qr",
    step: "connect",
    address: input.address.trim().toUpperCase(),
    serial: input.serial.trim().toUpperCase(),
    model: input.model,
    type: input.connectType,
  })
  return `/oppsett?${params}`
}

export function printerSetupParamsFromSearch(search: {
  get(name: string): string | null
}): PrinterSetupParams | null {
  const address = (search.get("address") || search.get("mac") || "").trim().toUpperCase()
  if (!address) return null
  const connectType: ConnectType = search.get("type") === "WiFi" ? "WiFi" : "BT"
  return {
    address,
    serial: (search.get("serial") || "").trim().toUpperCase(),
    model: (search.get("model") || DEFAULT_PRINTER_MODEL).trim() || DEFAULT_PRINTER_MODEL,
    connectType,
  }
}

/** Parse a sticker QR (https /oppsett/prt_…, /oppsett?printer=…, or an older /koble / /oppsett?address=…). */
export function parsePrinterSetupUrl(raw: string): PrinterSticker | null {
  const text = raw.trim()
  if (!text) return null

  let url: URL
  try {
    url = new URL(text, "https://local.invalid")
  } catch {
    return null
  }

  const path = url.pathname.replace(/\/+$/, "")
  const stickerId = path.match(/\/oppsett\/(prt_[0-9A-Z]+)$/)?.[1]
  if (stickerId) return { printerId: stickerId }

  const isKoble = path === "/koble" || path.endsWith("/koble")
  const isOppsett = path === "/oppsett" || path.endsWith("/oppsett")
  if (!isKoble && !isOppsett) return null

  const printerId = url.searchParams.get("printer")?.trim()
  if (printerId) return { printerId }

  const params = printerSetupParamsFromSearch(url.searchParams)
  return params ? { params } : null
}

/** Where a scanned sticker should take the browser. */
export function printerStickerPath(sticker: PrinterSticker): string {
  return "printerId" in sticker
    ? printerSetupPath(sticker.printerId)
    : printerSetupParamsPath(sticker.params)
}
