"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Search, Settings, UserPlus, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDeferredValue, useEffect, useRef, useState } from "react"
import { ManualCheckInDialog } from "@/components/manual-check-in"
import { ScanResultSheet } from "@/components/scan-result-sheet"
import { TdcLogo } from "@/components/tdc-logo"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
} from "@/components/ui/command"
import { attendeePath } from "@/lib/attendee-path"
import { fetchAttendee } from "@/lib/attendee-query"
import type { AttendeeStats } from "@/lib/attendees"
import { type Attendee, attendeeStatsSchema, attendeesSearchResponseSchema } from "@/lib/db/schema"
import { labelLine } from "@/lib/label-line"
import {
  SCAN_AUTO_PRINT_DEFAULT,
  SCAN_AUTO_PRINT_KEY,
  SCAN_INLINE_DEFAULT,
  SCAN_INLINE_KEY,
} from "@/lib/scan-settings"
import { setLocalFlag, useLocalFlag } from "@/lib/use-local-flag"
import { apiPath } from "@/lib/utils"

const INCLUDE_CHECKED_IN_KEY = "tdc-sok-include-checked-in"
const SHOW_ALL_KEY = "tdc-sok-show-all"

export function SearchScreen({
  initialStats,
  scanCamera,
}: {
  initialStats: AttendeeStats
  /** Off: this is the door's home (a PC/Mac), so there is no scanner to go back to. */
  scanCamera: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [q, setQ] = useState("")
  const [manualOpen, setManualOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inline = useLocalFlag(SCAN_INLINE_KEY, SCAN_INLINE_DEFAULT)
  const autoPrintSetting = useLocalFlag(SCAN_AUTO_PRINT_KEY, SCAN_AUTO_PRINT_DEFAULT)
  // A search home (PC/Mac at the door): picking a name is the decision, so Enter prints.
  const autoPrint = !scanCamera || autoPrintSetting === true
  const [card, setCard] = useState<{ attendee: Attendee; autoPrint: boolean } | null>(null)
  const opening = useRef(false)
  const storedIncludeCheckedIn = useLocalFlag(INCLUDE_CHECKED_IN_KEY)
  const storedShowAll = useLocalFlag(SHOW_ALL_KEY)
  const [includeCheckedIn, setIncludeCheckedIn] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const deferredQ = useDeferredValue(q.trim())

  useEffect(() => {
    if (storedIncludeCheckedIn !== null) setIncludeCheckedIn(storedIncludeCheckedIn)
  }, [storedIncludeCheckedIn])

  useEffect(() => {
    if (storedShowAll !== null) setShowAll(storedShowAll)
  }, [storedShowAll])

  const stats = useQuery({
    queryKey: ["attendee-stats"],
    queryFn: async () => {
      const response = await fetch(apiPath("/api/attendees/stats"))
      if (!response.ok) throw new Error("stats failed")
      return attendeeStatsSchema.parse(await response.json())
    },
  })
  const statsValue = stats.data ?? initialStats

  const searching = deferredQ.length > 0
  const browsing = !searching && showAll
  const active = searching || browsing

  const query = useQuery({
    queryKey: ["search", deferredQ, includeCheckedIn],
    enabled: active,
    queryFn: async () => {
      const params = new URLSearchParams({ q: deferredQ })
      if (includeCheckedIn) params.set("includeCheckedIn", "1")
      const response = await fetch(apiPath(`/api/attendees?${params}`))
      if (!response.ok) throw new Error("search failed")
      const body = attendeesSearchResponseSchema.parse(await response.json())
      return body.attendees
    },
  })

  const pending = active && (query.isPending || q.trim() !== deferredQ)
  // Toggling "vis alle" off only flips `enabled` — the query key is unchanged, so
  // TanStack still holds the last fetched rows. Gate on `active` or they leak back
  // in underneath the idle state.
  const results = active ? (query.data ?? []) : []

  function closeCard() {
    setCard(null)
    setQ("")
    inputRef.current?.focus()
  }

  function showCard(attendee: Attendee, print: boolean) {
    // Keys now belong to the card (Esc closes it), not to the search list behind it.
    inputRef.current?.blur()
    setCard({ attendee, autoPrint: print })
  }

  /** A result: the card over the search (fresh, so a check-in elsewhere shows), or the page. */
  async function openAttendee(row: Attendee) {
    if (inline === false) {
      router.push(attendeePath(row.id, { fromSearch: true }))
      return
    }
    if (opening.current) return
    opening.current = true
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: ["attendee", row.id],
        queryFn: () => fetchAttendee(row.id),
        staleTime: 0,
      })
      showCard(fresh ?? row, fresh != null && autoPrint)
    } catch {
      // Offline: show what the search had, but do not check in on stale data.
      showCard(row, false)
    } finally {
      opening.current = false
    }
  }

  // A card is up: typing starts the next search, so the keyboard flow never needs the mouse.
  useEffect(() => {
    if (!card) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key.length !== 1) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (document.querySelector('[role="dialog"]')) return
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea")) return
      setCard(null)
      setQ("")
      // Focus moves before the key lands, so the letter goes into the search.
      inputRef.current?.focus()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [card])

  function toggleIncludeCheckedIn() {
    const next = !includeCheckedIn
    setIncludeCheckedIn(next)
    setLocalFlag(INCLUDE_CHECKED_IN_KEY, next)
  }

  function toggleShowAll() {
    const next = !showAll
    setShowAll(next)
    setLocalFlag(SHOW_ALL_KEY, next)
  }

  return (
    <main className="attendee-reveal mx-auto flex h-dvh w-full max-w-2xl flex-col gap-5 overflow-hidden p-4 pt-[max(1rem,calc(env(safe-area-inset-top)+var(--printer-status-bar,0px)))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex shrink-0 items-center justify-between pt-2">
        <TdcLogo />
        <div className="flex items-center gap-3">
          <p className="text-base tabular-nums opacity-70">
            {`${statsValue.checkedIn} av ${statsValue.total}`}
          </p>
          {scanCamera ? null : (
            <Button asChild variant="surface" size="icon" className="rounded-full">
              <Link href="/innstillinger" aria-label="Innstillinger">
                <Settings className="size-5" aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      </header>

      <Command
        shouldFilter={false}
        loop
        label="Søk etter deltaker"
        className="flex min-h-0 flex-1 flex-col gap-5"
      >
        <div className="flex shrink-0 flex-col gap-3">
          <CommandInput
            ref={inputRef}
            autoFocus
            value={q}
            onValueChange={setQ}
            placeholder="Navn eller firma…"
            aria-label="Navn eller firma"
            onKeyDown={(event) => {
              if (event.key === "Escape" && q.length > 0) {
                event.preventDefault()
                setQ("")
              }
            }}
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showAll ? "default" : "surface"}
              className="h-11 flex-1 gap-2 px-3 text-base"
              aria-pressed={showAll}
              onClick={toggleShowAll}
            >
              <Users className="size-5" aria-hidden />
              Vis alle
            </Button>
            <Button
              type="button"
              variant={includeCheckedIn ? "default" : "surface"}
              className="h-11 flex-1 gap-2 px-3 text-base"
              aria-pressed={includeCheckedIn}
              onClick={toggleIncludeCheckedIn}
            >
              <Check className="size-5" aria-hidden />
              Innsjekkede
            </Button>
          </div>
        </div>

        <CommandList className="min-h-0 flex-1">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-8 text-center">
              <div className="search-idle-mark flex size-16 items-center justify-center rounded-full border border-[var(--color-fg-brand)]/40 text-[var(--color-fg-brand)]">
                <Search className="size-7" />
              </div>
              <p className="max-w-[16rem] text-lg leading-snug opacity-60">
                Søk etter navn eller firma, eller trykk «Vis alle»
              </p>
            </div>
          ) : null}

          {pending ? (
            <CommandLoading>
              <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Søker">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="search-item-in rounded-xl bg-[var(--color-bg-surface)] px-4 py-4"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div
                      className="attendee-loader-bar h-7 w-[70%]"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                    <div
                      className="attendee-loader-bar mt-3 h-4 w-[42%]"
                      style={{ animationDelay: `${i * 80 + 100}ms` }}
                    />
                  </li>
                ))}
              </ul>
            </CommandLoading>
          ) : null}

          {!pending && active && query.isError ? (
            <p className="search-item-in text-lg text-[var(--color-bg-danger)]">
              Søket feilet. Prøv igjen.
            </p>
          ) : null}

          {!pending && active && query.isSuccess && results.length === 0 ? (
            <CommandEmpty className="search-item-in flex flex-1 flex-col items-center justify-center gap-2 pb-8">
              <div className="search-idle-mark flex size-16 items-center justify-center rounded-full border border-[var(--color-fg-brand)]/40 text-[var(--color-fg-brand)]">
                <Search className="size-7" />
              </div>
              {searching ? (
                <>
                  <p className="text-2xl">Ingen treff</p>
                  <p className="max-w-[16rem] text-base opacity-60">
                    Fant ingen med «{deferredQ}». Prøv et annet navn.
                  </p>
                  {!includeCheckedIn ? (
                    <p className="max-w-[18rem] text-base opacity-60">
                      Innsjekkede er skjult. Trykk «Innsjekkede» for å ta dem med.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="surface"
                    className="mt-3 h-11 gap-2 px-4 text-base"
                    onClick={() => setManualOpen(true)}
                  >
                    <UserPlus className="size-5" aria-hidden />
                    Manuell innsjekk
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-2xl">Ingen deltakere</p>
                  <p className="max-w-[18rem] text-base opacity-60">
                    {includeCheckedIn
                      ? "Ingen deltakere er lastet inn ennå."
                      : "Alle er sjekket inn. Trykk «Innsjekkede» for å se dem."}
                  </p>
                </>
              )}
            </CommandEmpty>
          ) : null}

          {!pending && results.length > 0 ? (
            <CommandGroup key={`${deferredQ}-${includeCheckedIn}-${showAll}`}>
              {results.map((attendee, index) => {
                const line2 = labelLine(attendee.company, attendee.role)
                return (
                  <CommandItem
                    key={attendee.id}
                    value={attendee.id}
                    keywords={[attendee.name, attendee.company, attendee.role].filter(
                      (keyword) => keyword != null,
                    )}
                    onSelect={() => {
                      void openAttendee(attendee)
                    }}
                    className="flex-row items-center justify-between gap-3"
                    style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="block truncate font-display text-2xl leading-tight">
                        {attendee.name}
                      </span>
                      {line2 ? (
                        <span className="mt-1 block truncate text-base opacity-70 group-data-[selected=true]:opacity-80">
                          {line2}
                        </span>
                      ) : null}
                    </span>
                    {attendee.checkedInAt ? (
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-fg-brand)]/15 text-[var(--color-fg-brand)] group-data-[selected=true]:bg-[var(--color-fg-always-dark)]/15 group-data-[selected=true]:text-[var(--color-fg-always-dark)]"
                        title="Innsjekket"
                      >
                        <Check className="size-5" aria-hidden />
                        <span className="sr-only">Innsjekket</span>
                      </span>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>

      <div className="flex shrink-0 gap-3 pt-1">
        {scanCamera ? (
          <Button asChild variant="surface" size="lg" className="w-auto flex-none px-5 text-lg">
            <Link href="/">Tilbake</Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="surface"
          size="lg"
          className="min-w-0 flex-1 px-4 text-lg"
          onClick={() => setManualOpen(true)}
        >
          <UserPlus className="size-5" aria-hidden />
          Manuell innsjekk
        </Button>
      </div>

      <ManualCheckInDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        initialName={searching ? deferredQ : undefined}
        onCreated={(attendee) => {
          if (inline === false) {
            router.push(attendeePath(attendee.id, { fromSearch: true, printNow: true }))
          } else {
            showCard(attendee, true)
          }
        }}
      />

      {/* The sheet fills its parent; fixed, so it dims the whole window, not only the column. */}
      {card ? (
        <div className="fixed inset-0 z-20">
          <ScanResultSheet
            attendee={card.attendee}
            autoPrint={card.autoPrint}
            onDismiss={closeCard}
            onPrinted={closeCard}
          />
        </div>
      ) : null}
    </main>
  )
}
