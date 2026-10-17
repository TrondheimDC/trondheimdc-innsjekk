"use client"

import { LoaderCircle, Printer, QrCode } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AppPhaseButton,
  ConnectingPrintButton,
  PrinterConnectButton,
  PrinterMessage,
  printerBlocksPrint,
  printerNeedsConnect,
} from "@/components/printer-connect"
import { TdcLogo } from "@/components/tdc-logo"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { LabelPrintError, printSticker } from "@/lib/label-printer"
import { withStickerQrImage } from "@/lib/lbx-patch"
import { platformFromNavigator, printsDirect, supportsAndroidIntent } from "@/lib/platform"
import { currentPrintMethod, usePrintMethod } from "@/lib/print-method"
import {
  buildAndroidStickerIntent,
  buildStickerPrintUrl,
  DEFAULT_PAPER_SIZE_ID,
  loadTemplateBase64,
} from "@/lib/print-url"
import { stickerQrDataUrl } from "@/lib/printer-sticker-lbx"
import { setupStickerText } from "@/lib/public-app-url"
import {
  appLinkBusy,
  appLinkBusyLabel,
  appLinkNeedsAction,
  useAppLinkPhase,
  useLabelPrinter,
} from "@/lib/use-label-printer"
import { apiPath, cn } from "@/lib/utils"

/** Label in reader orientation: 90 × 38 mm DK-11208, in template points. */
const LABEL_W_PT = 255.1

/** Template points → container width units, so the preview scales as one piece. */
function pt(value: number) {
  return `${(value * 100) / LABEL_W_PT}cqw`
}

/** Single line in a 128 pt frame, shrunk to fit like the LBX `shrink="true"` NAME frame. */
function nameFontPt(name: string) {
  return Math.min(15, 128 / (Math.max(name.length, 1) * 0.56))
}

/**
 * On-screen stand-in for the landscape DK-11208 sticker (90 × 38 mm): QR on the
 * left, name and TDC art on the right. Boxes are the reader-space frames from
 * scripts/build-sticker-templates.ts (printer.lbx / stasjon.lbx).
 */
export function StickerPreview({
  name,
  url,
  variant = "setup",
  className,
}: {
  name: string
  url: string
  /** `login` is the stasjon.lbx sticker that covers the printer's model label. */
  variant?: "setup" | "login"
  /** Width override; everything inside scales with it. */
  className?: string
}) {
  const src = useMemo(() => (url ? stickerQrDataUrl(url) : null), [url])

  const login = variant === "login"
  const title = name || "Navn"

  return (
    <div className={cn("@container mx-auto w-80 max-w-full", className)}>
      <div className="relative aspect-[255.1/107.7] w-full overflow-hidden rounded-xl bg-[var(--color-white-1)] text-[var(--color-black)] [--color-fg-brand:var(--color-black)]">
        {src ? (
          <img
            src={src}
            alt=""
            className="absolute"
            style={{ left: pt(8.4), top: pt(4.35), width: pt(99), height: pt(99) }}
          />
        ) : (
          <div
            className="absolute bg-black/10"
            style={{ left: pt(8.4), top: pt(4.35), width: pt(99), height: pt(99) }}
          />
        )}
        {login ? (
          <p
            className="absolute flex items-center justify-end font-bold leading-none whitespace-nowrap"
            style={{ left: pt(150), top: pt(5), width: pt(94), height: pt(9), fontSize: pt(6.5) }}
          >
            Model QL-820NWBc
          </p>
        ) : null}
        <p
          className="absolute flex items-center font-bold leading-none whitespace-nowrap"
          style={{
            left: pt(116),
            top: pt(17),
            width: pt(128),
            height: pt(22),
            fontSize: pt(nameFontPt(title)),
          }}
        >
          {title}
        </p>
        <p
          className="absolute flex items-center justify-end leading-none whitespace-nowrap"
          style={{ left: pt(116), top: pt(75), width: pt(128), height: pt(9), fontSize: pt(6.5) }}
        >
          innsjekk.trondheimdc.no
        </p>
        <img
          src={apiPath("/badge/8bit-duck-dither.png")}
          alt=""
          className="absolute [image-rendering:pixelated]"
          style={{ left: pt(116), top: pt(54), width: pt(46), height: pt(46) }}
        />
        {/* 14 pt tall mark; gap is 7.28/52 of the height, as in tdc-logo.tsx. */}
        <div className="absolute" style={{ right: pt(11.1), top: pt(86) }}>
          <TdcLogo className="h-[5.49cqw] gap-[0.77cqw]" />
        </div>
      </div>
    </div>
  )
}

export function ShowStickerQrButton({
  name,
  url,
  label = "Oppsett-QR",
  description = "Skann koden for å koble telefonen i Smooth Print.",
  className,
  fallbackPath,
  templateFile,
}: {
  name: string
  url: string
  label?: string
  description?: string
  className?: string
  fallbackPath?: string
  templateFile?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="surface" className={className} onClick={() => setOpen(true)}>
        <QrCode className="size-5" aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>QR for {name}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <div className="mt-4 flex flex-col items-center gap-3">
            <StickerPreview name={setupStickerText(name)} url={url} />
            <PrintStickerButton
              name={setupStickerText(name)}
              url={url}
              fallbackPath={fallbackPath}
              templateFile={templateFile}
            />
          </div>
          <div className="mt-6">
            <DialogClose asChild>
              <Button variant="surface" size="lg">
                Lukk
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PrintStickerButton({
  name,
  url,
  fallbackPath = "/admin/printers",
  templateFile = "printer.lbx",
}: {
  name: string
  url: string
  /** Path for Android intent fallback when Smooth Print is missing. */
  fallbackPath?: string
  /**
   * `printer.lbx` (front, setup) or `stasjon.lbx` (login). Both get their QR
   * object swapped for the TDC QR image before Smooth Print prints them.
   */
  templateFile?: string
}) {
  const [busy, setBusy] = useState(false)
  const [directError, setDirectError] = useState<string | null>(null)
  const direct = printsDirect(usePrintMethod())
  const printer = useLabelPrinter()
  const link = useAppLinkPhase()
  const linkAction = appLinkNeedsAction(link)
  const linkBusy = appLinkBusy(link)

  async function printDirect() {
    setDirectError(null)
    setBusy(true)
    try {
      // Drawn in the browser from the same template and the same QR dots.
      await printSticker({ name, qr: url, templateFile })
      toast.success("Etiketten er sendt til printeren.")
    } catch (caught) {
      setDirectError(
        caught instanceof LabelPrintError ? caught.message : "Klarte ikke å skrive ut.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function print() {
    if (printsDirect(currentPrintMethod())) {
      await printDirect()
      return
    }
    setBusy(true)
    try {
      const fileBase64 = withStickerQrImage(await loadTemplateBase64(templateFile), url)
      const input = {
        fileBase64,
        paperSizeId: DEFAULT_PAPER_SIZE_ID,
        name,
      }
      const platform = platformFromNavigator()
      const href =
        platform === "android" && supportsAndroidIntent()
          ? buildAndroidStickerIntent({
              ...input,
              fallbackUrl: `${window.location.origin}${apiPath(fallbackPath)}`,
            })
          : buildStickerPrintUrl(input)
      window.location.href = href
    } catch {
      toast.error("Klarte ikke å åpne Smooth Print med etiketten.")
    } finally {
      setBusy(false)
    }
  }

  const button = linkBusy ? (
    <ConnectingPrintButton label={appLinkBusyLabel(link)} />
  ) : linkAction ? (
    <AppPhaseButton phase={link} />
  ) : direct && printerNeedsConnect(printer) ? (
    <PrinterConnectButton />
  ) : (
    <Button
      type="button"
      size="lg"
      disabled={busy || !name || !url || (direct && printerBlocksPrint(printer))}
      onClick={() => void print()}
    >
      {busy ? (
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
      ) : (
        <Printer className="size-5" aria-hidden />
      )}
      Skriv ut etikett
    </Button>
  )

  if (!direct) return button
  return (
    <div className="flex w-full flex-col gap-2">
      <PrinterMessage printer={printer} error={directError} />
      {button}
    </div>
  )
}
