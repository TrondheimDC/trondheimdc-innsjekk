"use client"

import { CircleCheck, X } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { CheckInButton } from "@/components/check-in-button"
import { CorrectAttendeeButton } from "@/components/correct-attendee-button"
import { MISSING_NAME_LABEL, MissingNameNotice } from "@/components/missing-name-notice"
import { PrintButton } from "@/components/print-button"
import { Button } from "@/components/ui/button"
import { useSetCheckedIn } from "@/hooks/use-set-checked-in"
import type { Attendee } from "@/lib/db/schema"
import { labelLine } from "@/lib/label-line"
import { type PhonePlatform, platformFromNavigator } from "@/lib/platform"
import { cn } from "@/lib/utils"

/** How long the self check-in confirmation stays up after a print. */
const CONFIRM_MS = 3000
/** Self check-in: an untouched "Allerede innsjekket" card closes after this. */
const IDLE_CLOSE_MS = 8000

/**
 * Non-modal card centred over a live camera — next scan replaces the current
 * attendee without tearing down the stream.
 */
export function ScanResultSheet({
  attendee,
  autoPrint,
  selfService = false,
  onConfirmedChange,
  onDismiss,
  onPrinted,
}: {
  attendee: Attendee | null
  autoPrint: boolean
  /** Self check-in stand: confirm a print before closing, and close untouched cards. */
  selfService?: boolean
  /** The self check-in confirmation shows (true) or has gone (false). */
  onConfirmedChange?: (confirmed: boolean) => void
  onDismiss: () => void
  onPrinted?: () => void
}) {
  const [platform, setPlatform] = useState<PhonePlatform>("other")
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [local, setLocal] = useState<Attendee | null>(attendee)
  const current = local ?? attendee
  const id = current?.id ?? ""
  const setCheckedIn = useSetCheckedIn(id)
  const [confirmed, setConfirmed] = useState(false)
  const idleTimer = useRef<number | undefined>(undefined)
  // The scanner passes a fresh arrow each render; timers must not restart with it.
  const dismiss = useEffectEvent(onDismiss)

  useEffect(() => {
    setPlatform(platformFromNavigator())
  }, [])

  useEffect(() => {
    setLocal(attendee)
    setOverrideError(null)
    setConfirmed(false)
  }, [attendee])

  const confirmedChanged = useEffectEvent((value: boolean) => onConfirmedChange?.(value))
  useEffect(() => {
    confirmedChanged(confirmed)
  }, [confirmed])

  useEffect(() => {
    if (!confirmed) return
    const timer = window.setTimeout(() => dismiss(), CONFIRM_MS)
    return () => window.clearTimeout(timer)
  }, [confirmed])

  // Someone already checked in only needs to see that. Any touch hands the card to the organizer.
  useEffect(() => {
    if (!selfService || attendee?.checkedInAt == null) return
    idleTimer.current = window.setTimeout(() => dismiss(), IDLE_CLOSE_MS)
    return () => window.clearTimeout(idleTimer.current)
  }, [selfService, attendee])

  // Not a Dialog (the camera keeps running), so Escape is ours to handle. A dialog
  // opened from the card (correction, print again) claims its Escape with preventDefault.
  const open = current != null
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return
      onDismiss()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onDismiss])

  if (!current) return null

  const line2 = labelLine(current.company, current.role)
  const checkedIn = current.checkedInAt != null
  // Checking in from this card (print, Sjekk inn) is still a new check-in; only the scan decides "Allerede".
  const alreadyCheckedIn = checkedIn && attendee?.checkedInAt != null
  const shouldAutoPrint = autoPrint === true && !checkedIn && Boolean(current.name)

  if (confirmed) {
    return (
      <div
        className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
        role="status"
        aria-live="polite"
        onClick={onDismiss}
      >
        <div className="attendee-reveal w-full max-w-sm overflow-hidden rounded-2xl bg-[var(--color-black-3)]/95 shadow-lg ring-1 ring-white/10 backdrop-blur-md">
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <CircleCheck className="size-14 text-[var(--color-fg-brand)]" aria-hidden />
            <p className="mt-2 text-sm tracking-wide text-[var(--color-fg-brand)]">Velkommen!</p>
            <h2 className="font-display w-full truncate text-3xl leading-tight">{current.name}</h2>
            <p className="text-base opacity-75">Navneskiltet skrives ut.</p>
          </div>
          <div
            className="self-service-countdown h-1 bg-[var(--color-fg-brand)]"
            style={{ animationDuration: `${CONFIRM_MS}ms` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 px-4 pt-[max(1rem,calc(env(safe-area-inset-top)+var(--printer-status-bar,0px)))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="status"
      aria-live="polite"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <div
        className="attendee-reveal max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-[var(--color-black-3)]/95 p-5 shadow-lg ring-1 ring-white/10 backdrop-blur-md"
        onPointerDown={() => window.clearTimeout(idleTimer.current)}
      >
        <div className="relative -m-2 rounded-xl p-2">
          <p
            className={cn(
              "text-sm tracking-wide",
              alreadyCheckedIn
                ? "font-semibold text-[var(--color-orange)]"
                : "text-[var(--color-fg-brand)]",
            )}
          >
            {alreadyCheckedIn ? "Allerede innsjekket" : "Ny innsjekk"}
          </p>
          <h2
            className={cn(
              "font-display mt-0.5 truncate pr-6 text-2xl leading-tight",
              !current.name && "text-[var(--color-bg-danger)]",
            )}
          >
            {current.name ?? MISSING_NAME_LABEL}
          </h2>
          {line2 ? <p className="mt-1 truncate pr-6 text-base opacity-75">{line2}</p> : null}
          <CorrectAttendeeButton attendee={current} onCorrected={setLocal} />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {overrideError ? (
            <p className="text-sm text-[var(--color-bg-danger)]">{overrideError}</p>
          ) : null}
          {current.name ? (
            <PrintButton
              key={current.id}
              attendeeId={current.id}
              name={current.name}
              line2={line2}
              platform={platform}
              checkedIn={checkedIn}
              autoPrint={shouldAutoPrint}
              onPrinted={selfService ? () => setConfirmed(true) : onPrinted}
              onCheckIn={async () => {
                const next = await setCheckedIn.mutateAsync(true)
                setLocal(next)
              }}
            />
          ) : (
            <MissingNameNotice key={current.id} attendee={current} onCorrected={setLocal} />
          )}
          {!shouldAutoPrint ? (
            <CheckInButton
              checkedIn={checkedIn}
              onToggle={async () => {
                setOverrideError(null)
                try {
                  const next = await setCheckedIn.mutateAsync(!checkedIn)
                  setLocal(next)
                } catch {
                  setOverrideError("Klarte ikke å oppdatere innsjekk. Prøv igjen.")
                  throw new Error("check-in failed")
                }
              }}
            />
          ) : null}
          <Button type="button" variant="surface" size="lg" onClick={onDismiss}>
            <X className="size-5" aria-hidden />
            Lukk
          </Button>
        </div>
      </div>
    </div>
  )
}
