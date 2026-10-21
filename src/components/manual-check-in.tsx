"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, Printer } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useLayoutEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { BadgePreview } from "@/components/badge-preview"
import { attendeeFieldClass } from "@/components/correct-attendee-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCreateAttendee } from "@/hooks/use-create-attendee"
import { attendeePath } from "@/lib/attendee-path"
import {
  type CorrectAttendeeBody,
  type CorrectAttendeeInput,
  manualAttendeeBodySchema,
} from "@/lib/db/schema"
import { labelLine } from "@/lib/label-line"

/**
 * Someone who is not on the Checkin list: type in the badge, then print and check in on the
 * attendee screen. The row and who added it are kept, so admin can see every manual badge.
 */
export function ManualCheckInDialog({
  open,
  onOpenChange,
  initialName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What staff searched for, so a miss turns into a badge without typing it twice. */
  initialName?: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const companyId = useId()
  const roleId = useId()
  const create = useCreateAttendee()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CorrectAttendeeInput, unknown, CorrectAttendeeBody>({
    resolver: zodResolver(manualAttendeeBodySchema),
    defaultValues: { name: null, company: null, role: null },
  })

  const [name, company, role] = watch(["name", "company", "role"])

  // Start blank (or from the search) each time it opens. Layout effect: no flash of the last one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the dialog opens
  useLayoutEffect(() => {
    if (!open) return
    reset({ name: initialName?.trim() || null, company: null, role: null })
    setError(null)
  }, [open])

  async function onSubmit(values: CorrectAttendeeBody) {
    setError(null)
    try {
      const attendee = await create.mutateAsync(values)
      router.push(attendeePath(attendee.id, { fromSearch: true, printNow: true }))
    } catch {
      setError("Klarte ikke å lagre deltakeren. Prøv igjen.")
    }
  }

  // Navigating away: keep the button busy until the attendee screen takes over.
  const busy = create.isPending || create.isSuccess

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Manuell innsjekk</DialogTitle>
        <DialogDescription>For den som ikke står på listen. Innsjekken logges.</DialogDescription>

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
              autoFocus
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
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              ) : (
                <Printer className="size-5" aria-hidden />
              )}
              Skriv ut og sjekk inn
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
