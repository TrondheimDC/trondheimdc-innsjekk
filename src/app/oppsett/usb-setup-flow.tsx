"use client"

import {
  Check,
  CircleCheck,
  Copy,
  Download,
  LoaderCircle,
  Printer,
  ScanLine,
  Search,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"
import { BadgePreview } from "@/components/badge-preview"
import {
  LinuxUdevIllustration,
  UsbCableIllustration,
  UsbPickerIllustration,
  ZadigIllustration,
} from "@/components/illustrations"
import {
  PrinterConnectButton,
  PrinterMessage,
  printerBlocksPrint,
  printerNeedsConnect,
} from "@/components/printer-connect"
import { Button } from "@/components/ui/button"
import { LabelPrintError, printBadge } from "@/lib/label-printer"
import { type DesktopOs, desktopOsFromNavigator } from "@/lib/platform"
import { setScanCamera } from "@/lib/scan-camera"
import { markSetupSeen } from "@/lib/setup-seen"
import { useLabelPrinter } from "@/lib/use-label-printer"
import { apiPath } from "@/lib/utils"

const TEST_NAME = "Test"
const TEST_LINE2 = "TDC"

/** Zadig 2.9 release asset. No install; the exe opens directly. */
const ZADIG_URL = "https://github.com/pbatard/libwdi/releases/download/v1.5.1/zadig-2.9.exe"

const artClassName = "max-h-full rounded-2xl bg-[var(--color-bg-surface)]"

/** Gives the logged-in desktop user the printer, and stops `usblp` from grabbing it. */
const LINUX_COMMANDS = [
  `echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="04f9", ATTR{idProduct}=="209d", MODE="0660", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/60-brother-ql.rules`,
  "sudo udevadm control --reload",
  "sudo modprobe -r usblp",
].join("\n")

type UsbStepId = "mode" | "usb" | "driver" | "connect" | "test-print"

/** Mac needs no driver; Windows swaps in WinUSB with Zadig; Linux adds a udev rule. */
function stepsFor(os: DesktopOs): UsbStepId[] {
  return os === "windows" || os === "linux"
    ? ["mode", "usb", "driver", "connect", "test-print"]
    : ["mode", "usb", "connect", "test-print"]
}

/** The door home: search (no camera) or the scanner. Writes the same cookie as Innstillinger. */
const MODES = [
  {
    scanCamera: false,
    icon: Search,
    title: "Søk",
    body: "Finn deltakeren på navn. Enter skriver ut og sjekker inn.",
  },
  {
    scanCamera: true,
    icon: ScanLine,
    title: "Skann",
    body: "Les QR-koden på billetten med kameraet.",
  },
] as const

const DRIVER_COPY: Record<"windows" | "linux", { title: string; body: string }> = {
  windows: {
    title: "Installer USB-driveren",
    body: "Last ned og åpne Zadig. Velg QL-820NWB (Options → List All Devices), velg WinUSB og trykk Replace Driver.",
  },
  linux: {
    title: "Gi nettleseren tilgang",
    body: "Gjøres én gang per maskin. Kjør kommandoene i en terminal, og trekk ut kabelen og sett den i igjen.",
  },
}

const STEPS: Record<Exclude<UsbStepId, "driver">, { title: string; body: string }> = {
  mode: {
    title: "Søk eller skann?",
    body: "Hvordan skal deltakerne finnes på denne maskinen? Kan endres i Innstillinger.",
  },
  usb: {
    title: "Koble til med USB",
    body: "Sett USB-kabelen i printeren og maskinen, og slå printeren på.",
  },
  connect: {
    title: "Velg printeren",
    body: "Trykk Koble til printer og velg QL-820NWB i listen nettleseren viser.",
  },
  "test-print": {
    title: "Skriv ut et testskilt",
    body: "Sjekker ikke inn noen deltaker.",
  },
}

const noopSubscribe = () => () => {}

/** PC/Mac setup: search or scan → USB cable → (Windows/Linux driver) → pick the printer → test print. */
export function UsbSetupFlow({
  initialStep,
  initialOs,
  initialScanCamera,
}: {
  initialStep: string | null
  /** From the request UA so the first paint already has the right steps. */
  initialOs: DesktopOs
  /** The home chosen before, from the cookie; null until this device has chosen. */
  initialScanCamera: boolean | null
}) {
  const router = useRouter()
  const usb = useLabelPrinter()
  const os = useSyncExternalStore(
    noopSubscribe,
    () => desktopOsFromNavigator(),
    () => initialOs,
  )
  const stepIds = stepsFor(os)
  const [stepId, setStepId] = useState<UsbStepId>(() => {
    const wanted = (initialStep ?? "mode") as UsbStepId
    return stepsFor(initialOs).includes(wanted) ? wanted : "mode"
  })
  const [scanCamera, setScanCameraState] = useState(initialScanCamera)
  const step = Math.max(0, stepIds.indexOf(stepId))
  const [busy, setBusy] = useState(false)
  const [printed, setPrinted] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const unsupported = usb.kind === "unsupported"
  const current =
    stepId === "driver" ? DRIVER_COPY[os === "linux" ? "linux" : "windows"] : STEPS[stepId]

  useEffect(() => {
    const next = apiPath(`/oppsett?step=${stepId}`)
    if (`${window.location.pathname}${window.location.search}` === next) return
    // Same as the phone wizard: replaceState so a step change does not remount the flow.
    window.history.replaceState(window.history.state, "", next)
  }, [stepId])

  function go(offset: number) {
    const next = stepIds[step + offset]
    if (next) setStepId(next)
  }

  function chooseMode(on: boolean) {
    setScanCamera(on)
    setScanCameraState(on)
    go(1)
  }

  function finish() {
    markSetupSeen()
    router.push(scanCamera === true ? "/" : "/sok")
  }

  async function copyCommands() {
    await navigator.clipboard.writeText(LINUX_COMMANDS)
    setCopied(true)
  }

  async function printTest() {
    setPrintError(null)
    setBusy(true)
    try {
      await printBadge({ name: TEST_NAME, line2: TEST_LINE2 })
      setPrinted(true)
    } catch (caught) {
      setPrintError(caught instanceof LabelPrintError ? caught.message : "Klarte ikke å skrive ut.")
    } finally {
      setBusy(false)
    }
  }

  if (unsupported) {
    return (
      <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-[max(1rem,calc(env(safe-area-inset-top)+var(--printer-status-bar,0px)))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <UsbCableIllustration className={artClassName} />
        </div>
        <h1 className="mt-1 shrink-0 text-3xl">Bruk Chrome eller Edge</h1>
        <p className="mt-2 shrink-0 text-base leading-snug">
          Utskrift fra PC/Mac går over USB, og bare nettlesere som støtter WebUSB kan det.{" "}
          <a
            href="https://caniuse.com/webusb"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Se hvilke
          </a>
        </p>
        <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
          <Button asChild variant="ghost" className="h-12 w-full text-base">
            <Link href="/">Avbryt</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-[max(1rem,calc(env(safe-area-inset-top)+var(--printer-status-bar,0px)))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mb-3 flex shrink-0 gap-2">
        {stepIds.map((id, index) => (
          <span
            key={id}
            className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[var(--color-fg-brand)]" : "bg-[var(--color-bg-surface)]"}`}
          />
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {stepId === "mode" ? (
          <div className="flex w-full flex-col gap-3">
            {MODES.map((mode) => (
              <Button
                key={mode.title}
                type="button"
                variant={scanCamera === mode.scanCamera ? "default" : "surface"}
                aria-pressed={scanCamera === mode.scanCamera}
                className="h-auto w-full items-start justify-start gap-4 px-5 py-5 text-left whitespace-normal"
                onClick={() => chooseMode(mode.scanCamera)}
              >
                <mode.icon className="mt-0.5 size-6 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 font-normal">
                  <span className="block text-xl font-semibold">{mode.title}</span>
                  <span className="mt-1 block text-base opacity-75">{mode.body}</span>
                </span>
              </Button>
            ))}
          </div>
        ) : stepId === "usb" ? (
          <UsbCableIllustration className={artClassName} />
        ) : stepId === "driver" ? (
          os === "linux" ? (
            <LinuxUdevIllustration className={artClassName} />
          ) : (
            <ZadigIllustration className={artClassName} />
          )
        ) : stepId === "connect" && usb.kind !== "ready" && usb.kind !== "connecting" ? (
          <UsbPickerIllustration className={artClassName} />
        ) : stepId === "connect" ? (
          <div className="flex w-full items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-5 py-6">
            {usb.kind === "ready" ? (
              <CircleCheck className="size-8 shrink-0 text-[var(--color-fg-brand)]" aria-hidden />
            ) : (
              <LoaderCircle className="size-8 shrink-0 animate-spin opacity-60" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="text-lg">
                {usb.kind === "ready" ? "QL-820NWB er koblet til" : "Kobler til…"}
              </p>
              <p className="mt-1 font-mono text-sm break-all opacity-60">
                {usb.kind === "ready" && usb.serial ? `SN ${usb.serial}` : "USB"}
              </p>
            </div>
          </div>
        ) : (
          <BadgePreview name={TEST_NAME} line2={TEST_LINE2} />
        )}
      </div>

      <p className="mt-2 shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">
        {step + 1} av {stepIds.length}
      </p>
      <h1 className="mt-1 shrink-0 text-3xl">{current.title}</h1>
      <p className="mt-2 shrink-0 text-base leading-snug">{current.body}</p>

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
        {stepId === "usb" ? (
          <Button className="h-12 w-full text-base" onClick={() => go(1)}>
            Neste
          </Button>
        ) : null}

        {stepId === "driver" ? (
          <>
            {os === "linux" ? (
              <Button
                variant="surface"
                className="h-12 w-full text-base"
                onClick={() => void copyCommands()}
              >
                {copied ? (
                  <Check className="size-5" aria-hidden />
                ) : (
                  <Copy className="size-5" aria-hidden />
                )}
                {copied ? "Kopiert" : "Kopier kommandoer"}
              </Button>
            ) : (
              <Button asChild variant="surface" className="h-12 w-full text-base">
                <a href={ZADIG_URL}>
                  <Download className="size-5" aria-hidden />
                  Last ned Zadig
                </a>
              </Button>
            )}
            <Button className="h-12 w-full text-base" onClick={() => go(1)}>
              Neste
            </Button>
          </>
        ) : null}

        {stepId === "connect" ? (
          <>
            <PrinterMessage printer={usb} error={null} />
            {printerNeedsConnect(usb) ? (
              <PrinterConnectButton size="default" className="h-12 w-full text-base" />
            ) : null}
            <Button
              className="h-12 w-full text-base"
              disabled={usb.kind !== "ready"}
              onClick={() => go(1)}
            >
              Neste
            </Button>
          </>
        ) : null}

        {stepId === "test-print" ? (
          <>
            <PrinterMessage printer={usb} error={printError} />
            {printerNeedsConnect(usb) ? (
              <PrinterConnectButton size="default" className="h-12 w-full text-base" />
            ) : (
              <Button
                variant={printed ? "surface" : "default"}
                className="h-12 w-full text-base"
                disabled={busy || printerBlocksPrint(usb)}
                onClick={() => void printTest()}
              >
                {busy ? (
                  <LoaderCircle className="size-5 animate-spin" aria-hidden />
                ) : (
                  <Printer className="size-5" aria-hidden />
                )}
                {busy ? "Skriver ut…" : printed ? "Skriv ut igjen" : "Skriv ut testskilt"}
              </Button>
            )}
            <Button className="h-12 w-full text-base" disabled={!printed} onClick={finish}>
              {scanCamera === true ? "Begynn å skanne" : "Begynn å søke"}
            </Button>
            <Button variant="ghost" className="h-12 w-full text-base" onClick={finish}>
              Hopp over testen
            </Button>
          </>
        ) : null}

        {step === 0 ? (
          <Button asChild variant="ghost" className="h-12 w-full text-base">
            <Link href="/">Avbryt</Link>
          </Button>
        ) : (
          <Button variant="ghost" className="h-12 w-full text-base" onClick={() => go(-1)}>
            Tilbake
          </Button>
        )}
      </div>
    </main>
  )
}
