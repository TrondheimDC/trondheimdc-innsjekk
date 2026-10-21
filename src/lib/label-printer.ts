"use client"

import type { WebBrotherQLPrinter } from "@thermal-label/brother-ql-web"
import { type BadgeInput, badgePrintImage, renderBadge, renderSticker } from "@/lib/badge-render"

/**
 * Direct printing: the page draws the label and sends Brother raster itself.
 * PC/Mac over WebUSB (`usb-printer.ts`), the Android app over Bluetooth
 * (`app-printer.ts`). One connection per tab, kept across client navigations.
 */

/** Brother media id for the 38 × 90 mm die-cut (DK-11208). */
const DK_11208_MEDIA_ID = 272

export type PrinterLink = "usb" | "bluetooth"

export type LabelPrinterState =
  | { kind: "unsupported" }
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "ready"; link: PrinterLink; serial: string | null; name: string | null }
  | { kind: "error"; message: string; driverHelp: boolean }

export class LabelPrintError extends Error {
  constructor(
    message: string,
    readonly driverHelp = false,
  ) {
    super(message)
  }
}

type Opened = { printer: WebBrotherQLPrinter; serial?: string | null; name?: string | null }

/** Starts as connecting: the first restore re-opens a remembered printer or settles on idle. */
let state: LabelPrinterState = { kind: "connecting" }
let printer: WebBrotherQLPrinter | null = null
let printerLink: PrinterLink | null = null
let opening: Promise<void> | null = null
/** Re-opens the last printer when the link dropped (Bluetooth sleeps between prints). */
let reopen: (() => Promise<void>) | null = null
const listeners = new Set<() => void>()

export function setPrinterState(next: LabelPrinterState) {
  state = next
  for (const listener of listeners) listener()
}

export function printerState(): LabelPrinterState {
  return state
}

export function subscribePrinter(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function hasOpenPrinter(): boolean {
  return printer !== null
}

export function isOpening(): boolean {
  return opening !== null
}

/** Open a printer through a connector. Concurrent calls share the first attempt. */
export function openPrinter(
  link: PrinterLink,
  connect: () => Promise<Opened>,
  describe: (error: unknown) => LabelPrintError,
  options: { reopen?: () => Promise<void> } = {},
): Promise<void> {
  opening ??= (async () => {
    setPrinterState({ kind: "connecting" })
    try {
      const opened = await connect()
      printer = opened.printer
      printerLink = link
      reopen = options.reopen ?? null
      setPrinterState({
        kind: "ready",
        link,
        serial: opened.serial ?? null,
        name: opened.name ?? null,
      })
    } catch (error) {
      printer = null
      const failure = describe(error)
      setPrinterState({ kind: "error", message: failure.message, driverHelp: failure.driverHelp })
    } finally {
      opening = null
    }
  })()
  return opening
}

/** Forget the open printer (unplugged / link dropped / user disconnect). */
export async function closePrinter(options: { forget?: boolean } = {}) {
  const current = printer
  printer = null
  if (options.forget) reopen = null
  setPrinterState({ kind: "idle" })
  await current?.close().catch(() => {})
}

const WRONG_MEDIA_COPY = "Feil etiketter i printeren. Bruk DK-11208 (38 × 90 mm)."

const STATUS_COPY: Record<string, string> = {
  no_media: "Printeren er tom for etiketter. Legg i DK-11208.",
  media_end: "Etikettrullen er tom. Legg i en ny DK-11208.",
  cover_open: "Lokket på printeren er åpent. Lukk det og prøv igjen.",
  cutter_jam: "Kutteren har satt seg fast. Åpne lokket og fjern etiketten.",
  wrong_media: WRONG_MEDIA_COPY,
  not_ready: "Printeren er opptatt. Vent litt og prøv igjen.",
}

const LINK_COPY: Record<PrinterLink, { silent: string; aborted: string }> = {
  usb: {
    silent: "Printeren svarer ikke. Sjekk at den er på, og prøv igjen.",
    aborted: "Utskriften ble avbrutt. Sjekk kabelen og prøv igjen.",
  },
  bluetooth: {
    silent: "Printeren svarer ikke. Sjekk at den er på og i nærheten, og prøv igjen.",
    aborted: "Utskriften ble avbrutt. Sjekk at printeren er på og i nærheten, og prøv igjen.",
  },
}

type HeadImage = { width: number; height: number; data: Uint8Array }

/**
 * Check the printer, draw, then send. Resolves once the printer has the job.
 * Check in only after this resolves: any driver error then leaves the attendee out.
 */
async function printLabel(draw: () => Promise<HeadImage>): Promise<void> {
  if (!printer?.connected && reopen) await reopen()
  const current = printer
  if (!current?.connected) throw new LabelPrintError("Printeren er ikke koblet til.")
  const copy = LINK_COPY[printerLink ?? "usb"]
  const { findMedia } = await import("@thermal-label/brother-ql-core")
  const registered = findMedia(DK_11208_MEDIA_ID)
  if (!registered) throw new LabelPrintError("Mangler etikettformatet DK-11208.")
  // brother-ql-core 0.6.3 lists 0/0 margin pins for this die-cut, which sends
  // 413-pin rows to a 720-pin head. Use the 38 mm geometry (same as its 38 mm
  // continuous roll and Brother's pin table): 12 + 413 + 295 = 720.
  const media = { ...registered, leftMarginPins: 12, rightMarginPins: 295 }

  let status: Awaited<ReturnType<WebBrotherQLPrinter["getStatus"]>>
  try {
    status = await current.getStatus()
  } catch {
    throw new LabelPrintError(copy.silent)
  }
  const problem = status.errors[0]
  if (problem) throw new LabelPrintError(STATUS_COPY[problem.code] ?? problem.message)
  if (status.detectedMedia && status.detectedMedia.id !== DK_11208_MEDIA_ID) {
    throw new LabelPrintError(WRONG_MEDIA_COPY)
  }

  const image = await draw()
  try {
    // The image is already portrait (head × feed) — never let the driver auto-rotate.
    await current.print(image, media, { rotate: 0 })
  } catch {
    throw new LabelPrintError(copy.aborted)
  }
}

export function printBadge(input: BadgeInput): Promise<void> {
  return printLabel(async () => badgePrintImage(await renderBadge(input)))
}

/** Setup / login sticker (`printer.lbx` / `stasjon.lbx` layout). */
export function printSticker(input: {
  name: string
  qr: string
  templateFile: string
}): Promise<void> {
  return printLabel(async () => badgePrintImage(await renderSticker(input)))
}
