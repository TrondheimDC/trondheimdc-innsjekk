"use client"

import { LoaderCircle, LogIn, Printer } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
  AppPhaseButton,
  ConnectingPrintButton,
  PrinterConnectButton,
  PrinterMessage,
  printerBlocksPrint,
  printerNeedsConnect,
} from "@/components/printer-connect"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { LabelPrintError, type LabelPrinterState, printBadge } from "@/lib/label-printer"
import {
  type PhonePlatform,
  printsDirect,
  refinePlatform,
  supportsAndroidIntent,
} from "@/lib/platform"
import { currentPrintMethod, usePrintMethod } from "@/lib/print-method"
import {
  consumePrintOutcome,
  primeForIosTabReuse,
  printCallbackQueryPrefix,
} from "@/lib/print-outcome"
import {
  buildAndroidPrintIntent,
  buildPrintUrl,
  DEFAULT_PAPER_SIZE_ID,
  loadTemplateBase64,
  type PrintCallback,
} from "@/lib/print-url"
import {
  appLinkBusy,
  appLinkBusyLabel,
  appLinkNeedsAction,
  useAppLinkPhase,
  useLabelPrinter,
} from "@/lib/use-label-printer"
import { apiPath } from "@/lib/utils"

/**
 * Smooth Print concatenates its result onto the end of this string verbatim, so the
 * URL has to end in a bare "key=" for the append to land as a value. Anything else
 * corrupts the path: a trailing "#utskrift" came back as
 * "%23utskriftSUCCESS&errorcode=SUCCESS" inside the path (it percent-encodes "#",
 * so a fragment cannot survive this round trip).
 *
 * iOS then also appends "&errorcode=SUCCESS". Android's success callback is only
 * "?result=SUCCESS" — no errorcode — which matches Brother's documented success URL.
 * Android badge prints omit the callback pair entirely (Smooth Print's dialog is
 * better UX than a new Chrome tab per print).
 *
 * Same URL for both callbacks — Brother only requires the pair to be present, not
 * distinct, and the appended value says which one fired.
 */
const LINK_SHOWN_IN_BAR: LabelPrinterState = { kind: "idle" }

function buildPrintCallback(): PrintCallback {
  // Same shape as primeForIosTabReuse, so Safari reuses the tab.
  const callbackUrl = `${window.location.origin}${window.location.pathname}?${printCallbackQueryPrefix()}result=`
  return { successCallback: callbackUrl, failureCallback: callbackUrl }
}

export function PrintButton({
  name,
  line2,
  platform: platformProp,
  checkedIn = false,
  onCheckIn,
  idleLabel = "Skriv ut navneskilt",
  doneLabel = "Skriv ut igjen",
  onPrinted,
  autoPrint = false,
}: {
  name: string
  line2: string
  platform: PhonePlatform
  checkedIn?: boolean
  onCheckIn?: () => Promise<void>
  idleLabel?: string
  doneLabel?: string
  onPrinted?: () => void
  /** Fire print once on mount when the attendee is not already checked in. */
  autoPrint?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [printed, setPrinted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The badge came out but the check-in failed: offer it again without printing twice. */
  const [checkInFailed, setCheckInFailed] = useState(false)
  const platform = refinePlatform(platformProp)
  const alreadyPrinted = checkedIn || printed
  // Orange only for someone who arrived checked in, not after this button checks them in.
  const [arrivedCheckedIn] = useState(checkedIn)
  const autoPrintStarted = useRef(false)
  const method = usePrintMethod()
  const printer = useLabelPrinter()
  const link = useAppLinkPhase()
  const linkAction = appLinkNeedsAction(link)
  const linkBusy = appLinkBusy(link)
  /** PC/Mac (USB) and the Android app draw and send the badge themselves. */
  const direct = printsDirect(method)
  const printerReady = printer.kind === "ready"

  useEffect(() => {
    const result = consumePrintOutcome(platform)
    if (!result) return
    if (result.success) setPrinted(true)
    else {
      setPrinted(false)
      setError("Smooth Print meldte at utskriften feilet. Prøv igjen.")
    }
    // Only ever meant to consume the callback this page load arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openPrint(fileBase64: string) {
    // Android: no successCallback/failureCallback. With the pair set, Chrome opens
    // a new tab per print; without it, Smooth Print shows its result dialog over
    // the same tab. iOS needs the pair or Smooth Print stays in front.
    const input = {
      fileBase64,
      paperSizeId: DEFAULT_PAPER_SIZE_ID,
      name,
      line2,
      ...(platform === "ios" ? { callback: buildPrintCallback() } : {}),
    }

    if (platform === "ios") primeForIosTabReuse()

    if (platform === "android" && supportsAndroidIntent()) {
      const fallbackUrl = `${window.location.origin}${apiPath("/oppsett")}`
      window.location.href = buildAndroidPrintIntent({ ...input, fallbackUrl })
    } else {
      window.location.href = buildPrintUrl(input)
    }
  }

  async function checkInAfterPrint(): Promise<boolean> {
    if (!onCheckIn) return true
    try {
      await onCheckIn()
      setCheckInFailed(false)
      return true
    } catch {
      setCheckInFailed(true)
      setError("Skiltet er skrevet ut, men innsjekken feilet.")
      return false
    }
  }

  /** Print first, check in last: a driver error never checks anyone in. */
  async function printDirect({ checkIn }: { checkIn: boolean }) {
    setError(null)
    setCheckInFailed(false)
    setBusy(true)
    try {
      try {
        await printBadge({ name, line2 })
      } catch (caught) {
        setError(
          caught instanceof LabelPrintError
            ? caught.message
            : "Klarte ikke å skrive ut. Prøv igjen.",
        )
        return
      }
      setPrinted(true)
      if (checkIn && !(await checkInAfterPrint())) return
      onPrinted?.()
    } finally {
      setBusy(false)
    }
  }

  async function retryCheckIn() {
    setError(null)
    setBusy(true)
    try {
      if (await checkInAfterPrint()) onPrinted?.()
    } finally {
      setBusy(false)
    }
  }

  async function print({ checkIn }: { checkIn: boolean }) {
    if (printsDirect(currentPrintMethod())) {
      await printDirect({ checkIn })
      return
    }
    setError(null)
    setBusy(true)
    try {
      const fileBase64 = await loadTemplateBase64()
      if (checkIn && onCheckIn) await onCheckIn()
      openPrint(fileBase64)
      setPrinted(true)
      onPrinted?.()
    } catch {
      setError(
        checkIn
          ? "Klarte ikke å sjekke inn eller hente malen. Prøv igjen."
          : "Klarte ikke å hente malen. Sjekk nettverket og prøv igjen.",
      )
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (autoPrint !== true || checkedIn || alreadyPrinted || autoPrintStarted.current) return
    if (method === null) return
    // Direct printing can only auto-print to a printer that is already open (the picker needs a tap).
    if (direct && !printerReady) return
    autoPrintStarted.current = true
    void print({ checkIn: Boolean(onCheckIn) })
    // Intentionally once per mount when autoPrint is explicitly true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, checkedIn, method, printerReady])

  return (
    <div className="flex flex-col gap-3">
      {direct ? (
        // The status bar already says why the link is down; keep the last print's error.
        <PrinterMessage printer={linkAction ? LINK_SHOWN_IN_BAR : printer} error={error} />
      ) : error ? (
        <p className="text-base text-[var(--color-bg-danger)]">{error}</p>
      ) : null}
      {checkInFailed && !checkedIn ? (
        <Button size="lg" disabled={busy} onClick={() => void retryCheckIn()}>
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : (
            <LogIn className="size-5" aria-hidden />
          )}
          Sjekk inn på nytt
        </Button>
      ) : null}
      {linkBusy ? (
        <ConnectingPrintButton label={appLinkBusyLabel(link)} />
      ) : linkAction ? (
        <AppPhaseButton phase={link} />
      ) : direct && printerNeedsConnect(printer) ? (
        <PrinterConnectButton />
      ) : (
        <Button
          size="lg"
          // TDC orange, so an attendee who already has a badge stands out.
          variant={arrivedCheckedIn && checkedIn ? "destructive" : "default"}
          disabled={busy || (direct && printerBlocksPrint(printer))}
          onClick={() => {
            if (alreadyPrinted) setConfirmOpen(true)
            else void print({ checkIn: Boolean(onCheckIn) })
          }}
        >
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : (
            <Printer className="size-5" aria-hidden />
          )}
          {busy ? (direct ? "Skriver ut…" : "Henter mal…") : alreadyPrinted ? doneLabel : idleLabel}
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Skriv ut igjen?</DialogTitle>
          <DialogDescription>
            Navneskiltet er allerede skrevet ut. Vil du skrive ut en gang til?
          </DialogDescription>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              size="lg"
              disabled={busy}
              onClick={() => {
                setConfirmOpen(false)
                void print({ checkIn: false })
              }}
            >
              {doneLabel}
            </Button>
            <DialogClose asChild>
              <Button variant="surface" size="lg">
                Avbryt
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
