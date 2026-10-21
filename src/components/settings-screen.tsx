"use client"

import { useMutation } from "@tanstack/react-query"
import {
  Camera,
  Download,
  LogOut,
  MapPin,
  PanelTop,
  Printer,
  ScanQrCode,
  ShieldCheck,
  Smartphone,
  UserRoundCheck,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"
import { TdcLogo } from "@/components/tdc-logo"
import { Button } from "@/components/ui/button"
import { APP_DOWNLOAD_PATH } from "@/lib/android-app"
import { authClient } from "@/lib/auth-client"
import { nativeQrSupported } from "@/lib/barcode-scan"
import { setScanCamera } from "@/lib/scan-camera"
import {
  SCAN_AUTO_PRINT_DEFAULT,
  SCAN_AUTO_PRINT_KEY,
  SCAN_INLINE_DEFAULT,
  SCAN_INLINE_KEY,
  SCAN_SELF_SERVICE_DEFAULT,
  SCAN_SELF_SERVICE_KEY,
  SCAN_ZXING_DEFAULT,
  SCAN_ZXING_KEY,
} from "@/lib/scan-settings"
import { setLocalFlag, useLocalFlag } from "@/lib/use-local-flag"

function SettingToggle({
  pressed,
  onToggle,
  disabled,
  icon,
  title,
  description,
}: {
  pressed: boolean
  onToggle: () => void
  disabled?: boolean
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "default" : "surface"}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className="flex h-auto w-full shrink-0 items-start justify-start gap-3 px-4 py-3.5 text-left text-base leading-snug whitespace-normal"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 font-normal">
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm opacity-70">{description}</span>
      </span>
    </Button>
  )
}

/**
 * The Android app's version (null for a local build), a newer uploaded one, if any, and
 * whether this login is an admin. The app has no address bar, so admin is reached from here.
 */
export type AppInfo = { version: string | null; update: string | null; admin: boolean }

export function SettingsScreen({
  printerName,
  scanCamera: initialScanCamera,
  app,
}: {
  printerName: string
  /** From the cookie, so the toggle paints right on the first frame. */
  scanCamera: boolean
  /** Only in the Android app. */
  app: AppInfo | null
}) {
  const router = useRouter()
  const [scanCamera, setScanCameraState] = useState(initialScanCamera)
  const scanInline = useLocalFlag(SCAN_INLINE_KEY, SCAN_INLINE_DEFAULT)
  const autoPrint = useLocalFlag(SCAN_AUTO_PRINT_KEY, SCAN_AUTO_PRINT_DEFAULT)
  const zxing = useLocalFlag(SCAN_ZXING_KEY, SCAN_ZXING_DEFAULT)
  const selfService = useLocalFlag(SCAN_SELF_SERVICE_KEY, SCAN_SELF_SERVICE_DEFAULT)
  // Null until checked; the toggle stays disabled until then, so the layout does not move.
  const [nativeDetector, setNativeDetector] = useState<boolean | null>(null)
  useEffect(() => {
    void nativeQrSupported().then(setNativeDetector)
  }, [])
  const flagsReady =
    scanInline !== null && autoPrint !== null && zxing !== null && selfService !== null

  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut()
      if (error) throw new Error(error.message ?? "sign_out_failed")
    },
    onSuccess: () => {
      router.push("/logg-inn")
    },
  })

  function toggleScanCamera() {
    setScanCamera(!scanCamera)
    setScanCameraState(!scanCamera)
  }

  function toggleScanInline() {
    setLocalFlag(SCAN_INLINE_KEY, scanInline !== true)
  }

  function toggleAutoPrint() {
    setLocalFlag(SCAN_AUTO_PRINT_KEY, autoPrint !== true)
  }

  function toggleZxing() {
    setLocalFlag(SCAN_ZXING_KEY, zxing !== true)
  }

  function toggleSelfService() {
    setLocalFlag(SCAN_SELF_SERVICE_KEY, selfService !== true)
  }

  return (
    // Clipped so the reveal's 12px slide does not make the page scroll while it plays.
    <div className="h-dvh overflow-clip">
      <main className="attendee-reveal mx-auto flex h-full w-full max-w-xl flex-col gap-6 p-4 pt-[max(1rem,calc(env(safe-area-inset-top)+var(--printer-status-bar,0px)))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <header className="shrink-0 pt-2">
          <TdcLogo />
          <h1 className="mt-2 text-4xl">Innstillinger</h1>
        </header>

        <div className="flex shrink-0 items-center gap-3 rounded-xl bg-[var(--color-bg-surface)] px-4 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-fg-brand)]/15 text-[var(--color-fg-brand)]">
            <MapPin className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm opacity-60">Innlogget som</p>
            <p className="font-display truncate text-xl">{printerName}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <p className="text-sm tracking-wide text-[var(--color-fg-brand)]">Innsjekk</p>

          <SettingToggle
            pressed={scanCamera}
            onToggle={toggleScanCamera}
            icon={<Camera className="size-5" aria-hidden />}
            title="Skann med kamera"
            description="Av: søket er forsiden. For en PC eller Mac uten kamera."
          />

          <SettingToggle
            pressed={flagsReady ? selfService === true : false}
            onToggle={toggleSelfService}
            disabled={!flagsReady || !scanCamera}
            icon={<UserRoundCheck className="size-5" aria-hidden />}
            title="Selvbetjening"
            description="Deltakerne skanner selv. Viser en bekreftelse etter utskrift og lukker kortet av seg selv."
          />

          <SettingToggle
            pressed={flagsReady ? autoPrint === true || selfService === true || !scanCamera : false}
            onToggle={toggleAutoPrint}
            disabled={!flagsReady || selfService === true || !scanCamera}
            icon={<Zap className="size-5" aria-hidden />}
            title="Skriv ut med en gang"
            description={
              scanCamera
                ? "Skriv ut automatisk for nye innsjekker."
                : "Alltid på når søket er forsiden: Enter skriver ut og sjekker inn."
            }
          />

          <SettingToggle
            pressed={
              flagsReady ? scanInline === false && !(scanCamera && selfService === true) : false
            }
            onToggle={toggleScanInline}
            disabled={!flagsReady || (scanCamera && selfService === true)}
            icon={<PanelTop className="size-5" aria-hidden />}
            title="Egen deltakerside"
            description="Åpne deltakeren på en egen side i stedet for et kort over skann og søk."
          />

          <Button
            asChild
            variant="surface"
            className="flex h-auto w-full shrink-0 items-center justify-start gap-3 px-4 py-3.5 text-left text-base whitespace-normal"
          >
            <Link href="/oppsett">
              <Printer className="size-5 shrink-0" aria-hidden />
              Oppsett av printer
            </Link>
          </Button>

          {app ? (
            <>
              <p className="mt-3 text-sm tracking-wide text-[var(--color-fg-brand)]">App</p>
              <div className="flex shrink-0 items-center gap-3 rounded-xl bg-[var(--color-bg-surface)] px-4 py-3.5">
                <Smartphone className="size-5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p>TDC Innsjekk {app.version ? `versjon ${app.version}` : "(utviklerbygg)"}</p>
                  {app.version && !app.update ? (
                    <p className="mt-1 text-sm opacity-70">Nyeste versjon</p>
                  ) : null}
                </div>
              </div>
              {app.update ? (
                <Button
                  asChild
                  className="flex h-auto w-full shrink-0 items-center justify-start gap-3 px-4 py-3.5 text-left text-base whitespace-normal"
                >
                  <Link
                    href={`${APP_DOWNLOAD_PATH}?${new URLSearchParams({ next: "/innstillinger" })}`}
                  >
                    <Download className="size-5 shrink-0" aria-hidden />
                    Oppdater til versjon {app.update}
                  </Link>
                </Button>
              ) : null}
              {/* Shown to everyone: door logins are never admin, and /admin asks for the admin login. */}
              <Button
                asChild
                variant="surface"
                className="flex h-auto w-full shrink-0 items-center justify-start gap-3 px-4 py-3.5 text-left text-base whitespace-normal"
              >
                <Link href="/admin">
                  <ShieldCheck className="size-5 shrink-0" aria-hidden />
                  {app.admin ? "Admin" : "Logg inn som admin"}
                </Link>
              </Button>
            </>
          ) : null}

          <p className="mt-3 text-sm tracking-wide text-[var(--color-fg-brand)]">Feilsøking</p>

          <SettingToggle
            pressed={flagsReady ? zxing === true || nativeDetector === false : false}
            onToggle={toggleZxing}
            disabled={!flagsReady || nativeDetector !== true || !scanCamera}
            icon={<ScanQrCode className="size-5" aria-hidden />}
            title="Skann med ZXing"
            description={
              nativeDetector === false
                ? "Denne enheten har ingen innebygd skanner, så ZXing brukes alltid."
                : "Bare hvis skanningen ikke virker. Tregere og bruker mer strøm enn den innebygde skanneren."
            }
          />

          <Button
            variant="ghost"
            className="flex h-auto w-full shrink-0 items-center justify-start gap-3 px-4 py-3.5 text-left text-base whitespace-normal text-[var(--color-bg-danger)] hover:bg-[color-mix(in_srgb,var(--color-bg-danger)_16%,transparent)] hover:text-[var(--color-bg-danger)]"
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
          >
            <LogOut className="size-5" aria-hidden />
            Logg ut
          </Button>

          {signOut.isError ? (
            <p className="text-sm text-[var(--color-bg-danger)]">
              Klarte ikke å logge ut. Prøv igjen.
            </p>
          ) : null}
        </div>

        <div className="shrink-0 pt-1">
          <Button asChild variant="surface" size="lg">
            <Link href={scanCamera ? "/" : "/sok"}>Tilbake</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
