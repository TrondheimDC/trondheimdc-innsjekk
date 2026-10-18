import {
  createObjectId,
  formatObjectId,
  isObjectIdBody,
  OBJECT_ID_ALPHABET,
  OBJECT_ID_BODY_LENGTH,
  type ObjectId,
} from "@/lib/db/object-id"

/** Lowercase prefix — static in the UI, like a serial-number label. */
export const PRINTER_TOKEN_PREFIX = "lgn" as const

export const PRINTER_TOKEN_PREFIX_LABEL = `${PRINTER_TOKEN_PREFIX}_` as const

/** Login stickers printed before printer ids took `prt_`; the body is the same token. */
const LEGACY_TOKEN_PREFIX_LABEL = "prt_"

export const PRINTER_TOKEN_BODY_LENGTH = OBJECT_ID_BODY_LENGTH

export type PrinterToken = ObjectId<"lgn">

export function createPrinterToken(): PrinterToken {
  return createObjectId("lgn")
}

export function formatPrinterToken(body: string): PrinterToken {
  return formatObjectId("lgn", body)
}

export function printerTokenBody(token: string): string {
  return stripTokenPrefix(token).toUpperCase()
}

function stripTokenPrefix(value: string): string {
  const lower = value.toLowerCase()
  for (const label of [PRINTER_TOKEN_PREFIX_LABEL, LEGACY_TOKEN_PREFIX_LABEL]) {
    if (lower.startsWith(label)) return value.slice(label.length)
  }
  return value
}

export function isPrinterTokenBody(value: string): boolean {
  return isObjectIdBody(value)
}

export function isPrinterToken(value: string): value is PrinterToken {
  if (stripTokenPrefix(value) === value) return false
  return isObjectIdBody(printerTokenBody(value))
}

/**
 * Live input for the body field: strip pasted `lgn_` (or legacy `prt_`), URLs, keep uppercase alphabet only.
 */
export function normalizePrinterTokenBodyInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""

  const fromUrl = extractTokenFromUrlish(trimmed)
  if (fromUrl) return printerTokenBody(fromUrl)

  const body = stripTokenPrefix(trimmed)
    .toUpperCase()
    .replace(new RegExp(`[^${OBJECT_ID_ALPHABET}]`, "g"), "")
  return body.slice(0, PRINTER_TOKEN_BODY_LENGTH)
}

/**
 * Normalize pasted text, full login URL (`/logg-inn/lgn_…` or `?token=`), raw `lgn_…`
 * (or legacy `prt_…`), or body-only into the canonical external token (`lgn_` + body).
 * Returns null if invalid.
 */
export function parsePrinterTokenInput(raw: string): PrinterToken | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const fromUrl = extractTokenFromUrlish(trimmed)
  if (fromUrl) return fromUrl

  const body = stripTokenPrefix(trimmed).toUpperCase()
  if (!isObjectIdBody(body)) return null
  return formatObjectId("lgn", body)
}

function extractTokenFromUrlish(raw: string): PrinterToken | null {
  try {
    const url = new URL(raw)
    const token = url.searchParams.get("token")?.trim()
    if (token) return parsePrinterTokenInput(token)
  } catch {
    // not an absolute URL
  }

  // Login sticker: /logg-inn/lgn_…
  const pathMatch = raw.match(/\/logg-inn\/(lgn_[0-9A-Z]+)(?:[/?#\s]|$)/i)
  if (pathMatch) return parsePrinterTokenInput(pathMatch[1])

  const queryMatch = raw.match(/[?&]token=([^&\s#]+)/i)
  if (queryMatch) {
    return parsePrinterTokenInput(decodeURIComponent(queryMatch[1]).trim())
  }

  return null
}
