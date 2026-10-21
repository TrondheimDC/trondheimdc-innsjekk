import { Check, UserPlus } from "lucide-react"
import type { Metadata } from "next"
import { attendeeRepository } from "@/lib/attendees"
import { labelLine } from "@/lib/label-line"

export const metadata: Metadata = { title: "Manuelle" }

// Rendered on the server: the event is in Trondheim whatever zone the host runs in.
const dateFormat = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
})

/** Every badge typed in at the door through Manuell innsjekk, and which login added it. */
export default async function ManualAttendeesPage() {
  const attendees = await attendeeRepository.listManual()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2">
        <h1 className="text-4xl">Manuelle</h1>
        <p className="mt-2 text-base opacity-70">
          Lagt inn i døra fordi de ikke sto på listen fra Checkin.
        </p>
      </header>

      {attendees.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-6 py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-full border border-[var(--color-fg-brand)]/40 text-[var(--color-fg-brand)]">
            <UserPlus className="size-7" aria-hidden />
          </div>
          <h2 className="text-2xl">Ingen manuelle innsjekker</h2>
          <p className="max-w-sm text-base opacity-70">
            Bruk «Manuell innsjekk» i søket for den som ikke står på listen.
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {attendees.map((attendee) => {
            const line2 = labelLine(attendee.company, attendee.role)
            return (
              <li
                key={attendee.id}
                className="flex items-start justify-between gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="font-display text-2xl leading-tight break-words">{attendee.name}</p>
                  {line2 ? <p className="mt-1 text-base opacity-80">{line2}</p> : null}
                  <p className="mt-3 text-sm opacity-60">
                    {dateFormat.format(new Date(attendee.createdAt))}
                    {attendee.createdBy ? ` · ${attendee.createdBy}` : null}
                  </p>
                  <p className="mt-1 font-mono text-xs break-all opacity-45">{attendee.id}</p>
                </div>
                {attendee.checkedInAt ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-fg-brand)]/15 px-3 py-1 text-sm text-[var(--color-fg-brand)]">
                    <Check className="size-4" aria-hidden />
                    Innsjekket
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm opacity-70">
                    Ikke innsjekket
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
