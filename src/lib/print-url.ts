import type { PhonePlatform } from "@/lib/platform"
import { DEFAULT_PRINTER_MODEL } from "@/lib/printer-models"

/** DK-11208 (38 × 90 mm). Matches Brother QL LabelSize DieCutW38H90. */
export const DEFAULT_PAPER_SIZE_ID = "DieCutW38H90"

/** Android applicationId from Smooth Print 1.9.0 APK. */
export const SMOOTH_PRINT_ANDROID_PACKAGE = "com.brother.ptouch.smoothprint"

export const IOS_APP_STORE = "https://apps.apple.com/us/app/smooth-print/id1629559918"

/** Brother’s Android APK agreement / download (not on Play Store). */
export const DEFAULT_SMOOTH_PRINT_ANDROID_URL =
  "https://support.brother.com/g/b/agreement.aspx?dlid=dlfp101087_000"

export { DEFAULT_PRINTER_MODEL }

/**
 * Brother requires both callbacks or neither ("If only one parameter is specified,
 * the setting will be invalid"). Docs assume a native app's own scheme, but plain
 * https URLs work on iOS — Smooth Print hands off to whatever handles the URL, and
 * Safari always claims http(s) — so Smooth Print returns to the browser after
 * printing instead of staying open.
 *
 * iOS appends its own `errorcode=` after the result. Android badge prints omit
 * the callback pair (new Chrome tab per return). See buildPrintCallback in
 * print-button.tsx.
 */
export type PrintCallback = { successCallback: string; failureCallback: string }

export function buildPrintQuery(input: {
  fileBase64: string
  paperSizeId: string
  name: string
  line2: string
  callback?: PrintCallback
}): string {
  const size = input.paperSizeId || DEFAULT_PAPER_SIZE_ID
  // filename is the name Smooth Print stores for the attached bytes.
  // fileattach embeds the template so Smooth Print does not HTTP-fetch it.
  // formatarchiveupdate=1: overwrite a cached template with the same name
  // (default is 0 — Smooth Print keeps the first badge.lbx forever).
  // Content stamp in the name is a second bust if an old install ignores the flag.
  // Do not use a base64 prefix — every .lbx zip starts with the same "UEsD…".
  const stamp = templateStamp(input.fileBase64)
  // Do not pass printMode=original: Brother's SDK returns SetMarginError for
  // this die-cut. Do not pass orientation either; the LBX already says portrait.
  // The template page is 38×90 pt-for-mm, so the default fit_to_page scale is 1.
  const pairs: [string, string][] = [
    ["filename", `badge-${stamp}.lbx`],
    ["fileattach", input.fileBase64],
    ["formatarchiveupdate", "1"],
    ["size", size],
    ["copies", "1"],
    ["text_NAME", input.name],
    ["text_LINE2", input.line2],
  ]
  if (input.callback) {
    pairs.push(["successCallback", input.callback.successCallback])
    pairs.push(["failureCallback", input.callback.failureCallback])
  }
  return pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
}

/** Short content-dependent id so Smooth Print does not reuse a stale cached .lbx. */
function templateStamp(fileBase64: string): string {
  let hash = 2166136261
  for (let i = 0; i < fileBase64.length; i++) {
    hash ^= fileBase64.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function buildPrintUrl(input: {
  fileBase64: string
  paperSizeId: string
  name: string
  line2: string
  callback?: PrintCallback
}): string {
  return `brotherwebprint://print?${buildPrintQuery(input)}`
}

/**
 * Chrome/Android intent URL: opens Smooth Print if installed, otherwise the fallback
 * (typically /oppsett). Package id from the official APK.
 */
export function buildAndroidPrintIntent(input: {
  fileBase64: string
  paperSizeId: string
  name: string
  line2: string
  fallbackUrl: string
  callback?: PrintCallback
}): string {
  const query = buildPrintQuery(input)
  const fallback = encodeURIComponent(input.fallbackUrl)
  return (
    `intent://print?${query}#Intent;` +
    `scheme=brotherwebprint;` +
    `package=${SMOOTH_PRINT_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${fallback};` +
    `end`
  )
}

export type ConnectType = "BT" | "WiFi"

/** Brother connect scheme. iOS QL over Bluetooth also needs serialnum. */
export function buildConnectQuery(input: {
  connectType: ConnectType
  address: string
  serial: string
  model: string
  platform?: PhonePlatform
  /** Omit so Smooth Print stays in front; staff return to the wizard themselves. */
  callbackUrl?: string
}): string {
  const ios = input.platform === "ios"
  let model = input.model.trim() || DEFAULT_PRINTER_MODEL
  let serial = input.serial.trim().toUpperCase()
  // iOS matches the MFi accessory, which reports `QL-820NWB` and the last 9 of a
  // 15-char serial (`E82696C6G972070` → `C6G972070`). Android wants the full values.
  if (ios) {
    model = model.replace(/c$/i, "")
    if (serial.length === 15) serial = serial.slice(-9)
  }
  const pairs: [string, string][] = [
    ["connecttype", input.connectType],
    ["connectaddress", input.address.trim().toUpperCase()],
    ["model", model],
  ]
  if (serial) pairs.push(["serialnum", serial])
  if (input.callbackUrl) pairs.push(["connectcallback", input.callbackUrl])
  return pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
}

export function buildConnectUrl(input: {
  connectType: ConnectType
  address: string
  serial: string
  model: string
  platform?: PhonePlatform
  callbackUrl?: string
}): string {
  return `brotherwebprint://connect?${buildConnectQuery(input)}`
}

export function buildAndroidConnectIntent(input: {
  connectType: ConnectType
  address: string
  serial: string
  model: string
  platform?: PhonePlatform
  callbackUrl?: string
  fallbackUrl: string
}): string {
  const query = buildConnectQuery(input)
  return (
    `intent://connect?${query}#Intent;` +
    `scheme=brotherwebprint;` +
    `package=${SMOOTH_PRINT_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(input.fallbackUrl)};` +
    `end`
  )
}

/**
 * Launch a `brotherwebprint://` URL.
 *
 * Safari only opens custom schemes via `location.href` from a user gesture.
 * On Android, assigning `location.href` (especially to `intent://…`) navigates
 * the tab and reloads the wizard — use a hidden iframe so Chrome stays put.
 */
export function openSmoothPrintScheme(url: string, platform: "ios" | "android" | "other"): void {
  if (platform === "ios") {
    window.location.href = url
    return
  }
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.tabIndex = -1
  iframe.style.display = "none"
  iframe.src = url
  document.body.appendChild(iframe)
  window.setTimeout(() => iframe.remove(), 2000)
}

export function templateUrl(file = "badge.lbx"): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""
  return `${window.location.origin}${base}/templates/${file}`
}

export function buildStickerPrintQuery(input: {
  fileBase64: string
  paperSizeId: string
  name: string
}): string {
  const size = input.paperSizeId || DEFAULT_PAPER_SIZE_ID
  const stamp = templateStamp(input.fileBase64)
  return [
    ["filename", `printer-${stamp}.lbx`],
    ["fileattach", input.fileBase64],
    ["formatarchiveupdate", "1"],
    ["size", size],
    ["copies", "1"],
    ["text_NAME", input.name],
  ]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
}

export function buildStickerPrintUrl(input: {
  fileBase64: string
  paperSizeId: string
  name: string
}): string {
  return `brotherwebprint://print?${buildStickerPrintQuery(input)}`
}

export function buildAndroidStickerIntent(input: {
  fileBase64: string
  paperSizeId: string
  name: string
  fallbackUrl: string
}): string {
  const query = buildStickerPrintQuery(input)
  return (
    `intent://print?${query}#Intent;` +
    `scheme=brotherwebprint;` +
    `package=${SMOOTH_PRINT_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(input.fallbackUrl)};` +
    `end`
  )
}

/** Fetch the hosted .lbx and return standard base64 (for fileattach). */
export async function loadTemplateBase64(file = "badge.lbx"): Promise<string> {
  const response = await fetch(templateUrl(file), { cache: "no-store" })
  if (!response.ok) throw new Error("template fetch failed")
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}
