import type { Metadata } from "next"
import { headers } from "next/headers"
import { userAgent } from "next/server"
import {
  desktopOsFromName,
  isAppUserAgent,
  platformFromOsName,
  printMethodFor,
} from "@/lib/platform"
import { type PrinterSetupParams, printerSetupParamsFromSearch } from "@/lib/printer-setup"
import { printerRepository } from "@/lib/printers"
import { storedScanCamera } from "@/lib/scan-camera-server"
import { resolveAndroidDownloadUrl } from "@/lib/smooth-print-apks"
import { apiPath } from "@/lib/utils"
import { SetupEntry } from "./setup-entry"
import type { SetupStepId } from "./setup-flow"

export const metadata: Metadata = { title: "Oppsett" }

const STEP_IDS = new Set<SetupStepId>([
  "install",
  "camera",
  "bt-on",
  "scan",
  "connect",
  "pair",
  "select",
  "confirm",
  "test-print",
])

function parseStep(value: string | undefined): SetupStepId | null {
  if (!value) return null
  return STEP_IDS.has(value as SetupStepId) ? (value as SetupStepId) : null
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{
    path?: string
    step?: string
    address?: string
    mac?: string
    serial?: string
    model?: string
    type?: string
    phase?: string
    result?: string
    primed?: string
    connectdebug?: string
    printer?: string
  }>
}) {
  const query = await searchParams
  const printerId = query.printer?.trim() || ""
  // Front stickers carry only the inventory id; the fields come from the database.
  const initialPrinter: PrinterSetupParams | null = printerId
    ? await loadInventoryPrinter(printerId)
    : printerSetupParamsFromSearch({
        get: (name) => (query as Record<string, string | undefined>)[name] ?? null,
      })
  const initialPath =
    query.path === "qr" || query.path === "manual" ? query.path : initialPrinter ? "qr" : null
  const androidUrl = await resolveAndroidDownloadUrl(apiPath)
  const { os, ua } = userAgent({ headers: await headers() })
  const initialPlatform = platformFromOsName(os.name)
  const initialPrintMethod = printMethodFor(initialPlatform, isAppUserAgent(ua))

  return (
    <>
      <link rel="preload" as="image" href="/oppsett/smooth-print.jpg" />
      {initialPlatform === "android" && initialPrintMethod === "smooth-print" ? (
        <link rel="preload" as="image" href="/oppsett/android-smooth-print-koblet.jpg" />
      ) : null}
      <SetupEntry
        rawStep={query.step ?? null}
        initialScanCamera={await storedScanCamera()}
        initialOs={desktopOsFromName(os.name)}
        initialPrintMethod={initialPrintMethod}
        androidUrl={androidUrl}
        initialPlatform={initialPlatform}
        initialPath={initialPath}
        initialStep={parseStep(query.step)}
        initialPrinter={initialPrinter}
        afterConnect={query.phase === "connected"}
        connectResult={query.result ?? null}
        initialPrimed={query.primed === "1"}
        connectDebug={query.connectdebug === "1"}
      />
    </>
  )
}

async function loadInventoryPrinter(printerId: string): Promise<PrinterSetupParams | null> {
  const printer = await printerRepository.getById(printerId)
  if (!printer) return null
  return {
    id: printer.id,
    address: printer.address,
    serial: printer.serial,
    model: printer.model,
    connectType: printer.connectType,
  }
}
