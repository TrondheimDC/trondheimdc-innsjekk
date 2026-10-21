"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, Pencil } from "lucide-react"
import { useId, useLayoutEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { BadgePreview } from "@/components/badge-preview"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useCorrectAttendee } from "@/hooks/use-correct-attendee"
import {
  type Attendee,
  type CorrectAttendeeBody,
  type CorrectAttendeeInput,
  correctAttendeeBodySchema,
} from "@/lib/db/schema"
import { labelLine } from "@/lib/label-line"
import { cn } from "@/lib/utils"

export const attendeeFieldClass =
  "h-12 w-full rounded-xl border border-white/15 bg-[var(--color-bg-base)] px-4 text-base text-[var(--color-fg-base)] outline-none focus-visible:border-[var(--color-fg-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-fg-brand)]/40"

/**
 * Overlay for a `relative` card: the whole card opens the dialog, with a small
 * pencil in the corner that takes no layout space.
 * Fix faulty registration data at the door. Saves as an override that a later
 * re-import leaves alone; the badge then prints from the corrected values.
 */
export function CorrectAttendeeButton({
  attendee,
  onCorrected,
  className,
}: {
  attendee: Attendee
  onCorrected?: (attendee: Attendee) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label="Rett opp navneskilt"
        className={cn(
          // Not btn-press: its unlayered `position: relative` beats `absolute`.
          "absolute inset-0 z-10 cursor-pointer touch-manipulation rounded-[inherit] transition-colors duration-150 ease-out hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-fg-brand)] active:bg-white/10",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <Pencil className="absolute top-3 right-3 size-4 opacity-60" aria-hidden />
      </button>
      <CorrectAttendeeDialog
        attendee={attendee}
        open={open}
        onOpenChange={setOpen}
        onCorrected={onCorrected}
      />
    </>
  )
}

/** The correction form on its own, for callers that open it from their own control. */
export function CorrectAttendeeDialog({
  attendee,
  open,
  onOpenChange,
  onCorrected,
}: {
  attendee: Attendee
  open: boolean
  onOpenChange: (open: boolean) => void
  onCorrected?: (attendee: Attendee) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const companyId = useId()
  const roleId = useId()
  const correct = useCorrectAttendee(attendee.id)

  // Unfilled ticket: offer Bedrift, unless the door already blanked the company on purpose.
  const suggestedCompany = attendee.correctedAt == null ? attendee.companySuggestion : null
  const initial = {
    name: attendee.name,
    company: attendee.company ?? suggestedCompany,
    role: attendee.role,
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CorrectAttendeeInput, unknown, CorrectAttendeeBody>({
    resolver: zodResolver(correctAttendeeBodySchema),
    defaultValues: initial,
  })

  const [name, company, role] = watch(["name", "company", "role"])
  const missingName = !attendee.name

  // Start from the current values each time it opens; not on every cache update while typing.
  // Layout effect: reset before paint so the last attendee's values never flash.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens
  useLayoutEffect(() => {
    if (!open) return
    reset(initial)
    setError(null)
  }, [open])

  async function onSubmit(values: CorrectAttendeeBody) {
    setError(null)
    try {
      const next = await correct.mutateAsync(values)
      onOpenChange(false)
      onCorrected?.(next)
    } catch {
      setError("Klarte ikke å lagre rettelsen. Prøv igjen.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{missingName ? "Skriv inn navn" : "Rett opp navneskilt"}</DialogTitle>

        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(event) => {
            void handleSubmit(onSubmit)(event)
          }}
        >
          <BadgePreview name={name} line2={labelLine(company, role)} />

          <div className="flex flex-col gap-2">
            <label htmlFor={nameId} className="text-sm font-medium opacity-80">
              Navn
            </label>
            <input
              id={nameId}
              className={attendeeFieldClass}
              autoComplete="off"
              autoFocus={missingName}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-sm text-[var(--color-bg-danger)]">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={companyId} className="text-sm font-medium opacity-80">
              Bedrift
            </label>
            <input
              id={companyId}
              className={attendeeFieldClass}
              autoComplete="off"
              {...register("company")}
            />
            {suggestedCompany != null ? (
              <p className={cn("text-sm opacity-60", company !== suggestedCompany && "invisible")}>
                Forslag fra Checkin – sjekk med deltakeren.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={roleId} className="text-sm font-medium opacity-80">
              Stilling
            </label>
            <input
              id={roleId}
              className={attendeeFieldClass}
              autoComplete="off"
              {...register("role")}
            />
          </div>

          {error ? <p className="text-base text-[var(--color-bg-danger)]">{error}</p> : null}

          <div className="flex flex-col gap-3">
            <Button type="submit" size="lg" disabled={correct.isPending}>
              {correct.isPending ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              ) : null}
              Lagre
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="surface" size="lg">
                Avbryt
              </Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
