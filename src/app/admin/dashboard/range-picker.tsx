"use client"

import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { nb } from "react-day-picker/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { addDays, type DashboardRange } from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"

/** Calendar days are plain dates: `2026-10-22` ↔ local midnight, no zone shift. */
function toLocalDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(year!, month! - 1, day!)
}
function fromLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const dayFormat = new Intl.DateTimeFormat("nb-NO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})
const shortDayFormat = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})
const asUtcNoon = (date: string) => new Date(`${date}T12:00:00Z`)

export function rangeLabel(range: DashboardRange): string {
  if (range.from === range.to) {
    const label = dayFormat.format(asUtcNoon(range.from))
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  return shortDayFormat.formatRange(asUtcNoon(range.from), asUtcNoon(range.to))
}

const sameRange = (a: DashboardRange, b: DashboardRange) => a.from === b.from && a.to === b.to

/**
 * Pick the dashboard's days, Grafana style: quick ranges on the left apply at once;
 * a custom range on the calendar applies with «Bruk». Days with check-ins carry a dot.
 */
export function RangePicker({
  range,
  today,
  activeDays,
  onChange,
}: {
  range: DashboardRange
  today: string
  activeDays: string[]
  onChange: (range: DashboardRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()
  const isMobile = useIsMobile()
  const single = range.from === range.to
  const latest = activeDays.at(-1)

  const presets: { label: string; range: DashboardRange }[] = [
    ...(latest ? [{ label: "Siste innsjekkdag", range: { from: latest, to: latest } }] : []),
    { label: "I dag", range: { from: today, to: today } },
    { label: "I går", range: { from: addDays(today, -1), to: addDays(today, -1) } },
    { label: "Siste 7 dager", range: { from: addDays(today, -6), to: today } },
    { label: "Siste 30 dager", range: { from: addDays(today, -29), to: today } },
    ...(activeDays.length > 1
      ? [{ label: "Alle innsjekkdager", range: { from: activeDays[0]!, to: latest! } }]
      : []),
  ]
  // Two presets can match the same days (the last check-in day is often today): tick the first.
  // While a custom range is being picked, no preset is ticked.
  const picked = draft ? -1 : presets.findIndex((preset) => sameRange(preset.range, range))

  const selected = draft ?? { from: toLocalDate(range.from), to: toLocalDate(range.to) }
  const months = isMobile ? 1 : 2
  const lastMonth = toLocalDate(range.to)
  const firstMonth =
    months === 2 ? new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1) : lastMonth

  function choose(next: DashboardRange) {
    setOpen(false)
    setDraft(undefined)
    onChange(next)
  }

  function apply() {
    if (!selected.from) return
    const from = fromLocalDate(selected.from)
    choose({ from, to: selected.to ? fromLocalDate(selected.to) : from })
  }

  const step = "h-7 px-2 opacity-60 hover:bg-white/10 hover:opacity-100"

  return (
    <div className="flex min-w-0 items-center gap-0.5 rounded-xl bg-white/5 p-1">
      {single ? (
        <Button
          variant="ghost"
          size="xs"
          aria-label="Dagen før"
          className={cn(step, "shrink-0")}
          onClick={() => onChange({ from: addDays(range.from, -1), to: addDays(range.from, -1) })}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      ) : null}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          setDraft(undefined)
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="h-7 min-w-0 bg-white/10 px-2.5 text-xs whitespace-nowrap hover:bg-white/15"
          >
            <CalendarDays className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{rangeLabel(range)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          collisionPadding={8}
          className="flex w-auto max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border-white/10 bg-[var(--color-bg-base)] p-0 md:flex-row"
        >
          <div className="flex flex-col gap-0.5 border-b border-white/10 p-2 md:w-48 md:border-r md:border-b-0">
            <p className="px-2 pt-1 pb-2 text-xs opacity-50">Hurtigvalg</p>
            <div className="flex flex-wrap gap-0.5 md:flex-col">
              {presets.map((preset, i) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 justify-between gap-3 px-2 text-sm font-normal hover:bg-white/10",
                    i === picked && "bg-white/10 font-semibold",
                  )}
                  onClick={() => choose(preset.range)}
                >
                  {preset.label}
                  {i === picked ? (
                    <Check className="size-4 text-[var(--color-fg-brand)]" aria-hidden />
                  ) : null}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-3">
              <RangeEnd label="Fra" date={selected.from} />
              <RangeEnd label="Til" date={selected.to ?? selected.from} />
            </div>
            <Calendar
              mode="range"
              locale={nb}
              weekStartsOn={1}
              numberOfMonths={months}
              defaultMonth={firstMonth}
              showOutsideDays={false}
              resetOnSelect
              selected={selected}
              onSelect={setDraft}
              disabled={{ after: toLocalDate(today) }}
              modifiers={{ active: activeDays.map(toLocalDate) }}
              modifiersClassNames={{
                active:
                  "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-[var(--color-fg-brand)]",
              }}
              // Phones: one month, bigger days for fingers, centered in the sheet.
              className="mx-auto bg-transparent p-3 max-md:[--cell-size:--spacing(10)]"
            />
            <div className="flex items-center justify-between gap-3 border-t border-white/10 p-3">
              <p className="flex items-center gap-1.5 text-xs opacity-60">
                <span className="size-1.5 rounded-full bg-[var(--color-fg-brand)]" aria-hidden />
                Dager med innsjekk
              </p>
              <div className="flex gap-2">
                <Button
                  variant="surface"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => setOpen(false)}
                >
                  Avbryt
                </Button>
                <Button
                  size="sm"
                  className="whitespace-nowrap"
                  disabled={!draft?.from}
                  onClick={apply}
                >
                  Bruk
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {single ? (
        <Button
          variant="ghost"
          size="xs"
          aria-label="Dagen etter"
          className={cn(step, "shrink-0")}
          disabled={range.from >= today}
          onClick={() => onChange({ from: addDays(range.from, 1), to: addDays(range.from, 1) })}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}

/** Read-only «Fra» / «Til» box above the calendar, like Grafana's absolute range. */
function RangeEnd({ label, date }: { label: string; date: Date | undefined }) {
  return (
    <div className="rounded-lg border border-white/10 px-3 py-1.5">
      <p className="text-[0.7rem] opacity-50">{label}</p>
      <p className="text-sm tabular-nums">
        {date ? shortDayFormat.format(asUtcNoon(fromLocalDate(date))) : "–"}
      </p>
    </div>
  )
}
