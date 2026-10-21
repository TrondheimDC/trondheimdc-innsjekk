"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ScanLine, Search } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { CheckInButton } from "@/components/check-in-button"
import { CorrectAttendeeButton } from "@/components/correct-attendee-button"
import { MISSING_NAME_LABEL, MissingNameNotice } from "@/components/missing-name-notice"
import { PrintButton } from "@/components/print-button"
import { usePrinterStatusBar } from "@/components/printer-connect"
import { TdcLogo } from "@/components/tdc-logo"
import { Button } from "@/components/ui/button"
import { useSetCheckedIn } from "@/hooks/use-set-checked-in"
import { PRINT_NOW_PARAM } from "@/lib/attendee-path"
import { attendeeResponseSchema } from "@/lib/db/schema"
import { labelLine } from "@/lib/label-line"
import { type PhonePlatform, platformFromNavigator } from "@/lib/platform"
import { SCAN_AUTO_PRINT_DEFAULT, SCAN_AUTO_PRINT_KEY } from "@/lib/scan-settings"
import { useLocalFlag } from "@/lib/use-local-flag"
import { apiPath, cn } from "@/lib/utils"

/** Where "next" goes: the search when staff came from it or the device has no scanner. */
function NextButton({ toSearch }: { toSearch: boolean }) {
  return (
    <Button asChild variant="surface" size="lg">
      {toSearch ? (
        <Link href="/sok">
          <Search className="size-5" aria-hidden />
          Søk neste
        </Link>
      ) : (
        <Link href="/">
          <ScanLine className="size-5" aria-hidden />
          Skann neste
        </Link>
      )}
    </Button>
  )
}

export function AttendeeScreen({
  id,
  scanCamera,
  fromSearch,
  printNow,
}: {
  id: string
  /** False on a PC/Mac with the camera off: the search is home. */
  scanCamera: boolean
  fromSearch: boolean
  /** Just added through Manuell innsjekk: print and check in at once. */
  printNow: boolean
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  usePrinterStatusBar()
  const toSearch = fromSearch || !scanCamera
  const backHref = toSearch ? "/sok" : "/"
  const [platform, setPlatform] = useState<PhonePlatform>("other")
  const autoPrintFlag = useLocalFlag(SCAN_AUTO_PRINT_KEY, SCAN_AUTO_PRINT_DEFAULT)

  useEffect(() => {
    setPlatform(platformFromNavigator())
  }, [])

  // Once only: a refresh or the Smooth Print callback must not print again.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(PRINT_NOW_PARAM)) return
    url.searchParams.delete(PRINT_NOW_PARAM)
    window.history.replaceState(window.history.state, "", url)
  }, [])

  // Keyboard at a PC: Esc goes back to the search (or scanner), unless a dialog has it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return
      if (document.querySelector('[role="dialog"]')) return
      router.push(backHref)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [router, backHref])
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ["attendee", id],
    queryFn: async () => {
      const response = await fetch(apiPath(`/api/attendees/${encodeURIComponent(id)}`))
      if (response.status === 404) return null
      if (!response.ok) throw new Error("lookup failed")
      const body = attendeeResponseSchema.parse(await response.json())
      return body.attendee
    },
  })

  const setCheckedIn = useSetCheckedIn(id)

  if (query.isPending) {
    return (
      <main
        className="flex min-h-dvh flex-col items-center justify-center px-6"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="w-full max-w-sm">
          <div className="attendee-loader-frame relative aspect-[90/38] overflow-hidden rounded-2xl border-2 bg-[var(--color-black-3)]">
            <div className="attendee-loader-sweep" />
            <div className="relative flex h-full flex-col justify-center gap-3 px-6">
              <div className="attendee-loader-bar h-7 w-[78%]" />
              <div
                className="attendee-loader-bar h-4 w-[46%]"
                style={{ animationDelay: "0.15s" }}
              />
            </div>
          </div>
          <p className="attendee-loader-label mt-8 text-center font-display text-sm uppercase text-[var(--color-fg-brand)]">
            Henter…
          </p>
        </div>
      </main>
    )
  }

  if (query.isError) {
    return (
      <main className="attendee-reveal mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-between p-4 pt-[max(1rem,calc(env(safe-area-inset-top)+var(--printer-status-bar,0px)))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm tracking-wide text-[var(--color-bg-danger)]">Noe gikk galt</p>
          <h1 className="text-4xl">Kunne ikke hente deltakeren</h1>
          <p className="max-w-[18rem] text-base opacity-60">
            Sjekk nettverket og prøv å skanne på nytt.
          </p>
        </div>
        <NextButton toSearch={toSearch} />
      </main>
    )
  }

  if (!query.data) {
    return (
      <main className="attendee-reveal mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-between p-4 pt-[max(1rem,calc(env(safe-area-inset-top)+var(--printer-status-bar,0px)))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="search-idle-mark flex size-16 items-center justify-center rounded-full border border-[var(--color-fg-brand)]/40 text-[var(--color-fg-brand)]">
            <Search className="size-7" />
          </div>
          <h1 className="text-4xl">Fant ikke deltakeren</h1>
          <p className="font-mono text-sm break-all opacity-50">{id}</p>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/sok">Søk</Link>
          </Button>
          {scanCamera ? (
            <Button asChild variant="surface" size="lg">
              <Link href="/">Skann neste</Link>
            </Button>
          ) : null}
        </div>
      </main>
    )
  }

  const attendee = query.data
  const line2 = labelLine(attendee.company, attendee.role)
  const checkedIn = attendee.checkedInAt != null
  const shouldAutoPrint = !checkedIn && (printNow || autoPrintFlag === true)

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-between overflow-hidden p-4 pt-[max(1rem,calc(env(safe-area-inset-top)+var(--printer-status-bar,0px)))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="attendee-badge-glow" aria-hidden />

      <div className="relative pt-4">
        <TdcLogo className="search-item-in" />

        <div className="attendee-badge relative mt-6 flex min-h-[9.5rem] flex-col justify-center rounded-2xl bg-[var(--color-black-3)] px-6 py-7">
          <h1
            className={cn(
              "pr-6 text-4xl leading-tight sm:text-5xl",
              !attendee.name && "text-[var(--color-bg-danger)]",
            )}
          >
            {attendee.name ?? MISSING_NAME_LABEL}
          </h1>
          {line2 ? <p className="mt-3 text-xl opacity-80">{line2}</p> : null}
          <p className="mt-5 font-mono text-xs tracking-wide break-all opacity-45">{attendee.id}</p>
          <CorrectAttendeeButton attendee={attendee} />
        </div>
      </div>

      <div className="attendee-stagger relative flex flex-col gap-3 pt-8">
        {overrideError ? (
          <p className="text-base text-[var(--color-bg-danger)]">{overrideError}</p>
        ) : null}
        {attendee.name ? (
          <PrintButton
            name={attendee.name}
            line2={line2}
            platform={platform}
            checkedIn={checkedIn}
            autoPrint={shouldAutoPrint}
            onCheckIn={async () => {
              const next = await setCheckedIn.mutateAsync(true)
              queryClient.setQueryData(["attendee", id], next)
            }}
          />
        ) : (
          <MissingNameNotice attendee={attendee} />
        )}
        <CheckInButton
          checkedIn={checkedIn}
          onToggle={async () => {
            setOverrideError(null)
            try {
              await setCheckedIn.mutateAsync(!checkedIn)
            } catch {
              setOverrideError("Klarte ikke å oppdatere innsjekk. Prøv igjen.")
              throw new Error("check-in failed")
            }
          }}
        />
        <NextButton toSearch={toSearch} />
      </div>
    </main>
  )
}
