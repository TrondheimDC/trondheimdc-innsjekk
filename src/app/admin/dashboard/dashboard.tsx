"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { nb } from "react-day-picker/locale"
import { NoCheckInsIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  addDays,
  type Dashboard,
  type DashboardRange,
  dashboardQueryKey,
  dashboardSchema,
  rangeSearch,
} from "@/lib/dashboard-data"
import {
  buckets,
  checkInTimes,
  defaultInterval,
  doorRows,
  fitsInterval,
  formatClock,
  formatDuration,
  INTERVALS,
  type Interval,
  keyNumbers,
  numberFormat,
  percentFormat,
} from "@/lib/dashboard-stats"
import { apiPath, cn } from "@/lib/utils"
import { BucketTable, CheckInBars, CumulativeLine } from "./charts"

async function fetchDashboard(range: DashboardRange): Promise<Dashboard> {
  const response = await fetch(apiPath(`/api/dashboard?${rangeSearch(range)}`))
  if (!response.ok) throw new Error("Klarte ikke å hente tallene")
  return dashboardSchema.parse(await response.json())
}

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

function rangeLabel(range: DashboardRange): string {
  if (range.from === range.to) {
    const label = dayFormat.format(asUtcNoon(range.from))
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  return shortDayFormat.formatRange(asUtcNoon(range.from), asUtcNoon(range.to))
}

const INTERVAL_LABELS: Record<Interval, string> = {
  1: "1 min",
  5: "5 min",
  15: "15 min",
  60: "1 time",
}

export function DashboardView({
  initialRange,
  today,
}: {
  initialRange: DashboardRange
  today: string
}) {
  const [range, setRange] = useState(initialRange)
  const [interval, setInterval] = useState<Interval | null>(null)

  const query = useQuery({
    queryKey: dashboardQueryKey(range),
    queryFn: () => fetchDashboard(range),
    placeholderData: keepPreviousData,
    // Today is still happening: keep the numbers moving while the door works.
    refetchInterval: range.to >= today ? 30_000 : false,
  })

  function pick(next: DashboardRange) {
    setRange(next)
    setInterval(null)
    // Keep the address bar in sync so a refresh or a shared link shows the same days.
    const url = new URL(window.location.href)
    url.search = rangeSearch(next)
    window.history.replaceState(window.history.state, "", url)
  }

  const dashboard = query.data

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2">
        <h1 className="text-4xl">Dashboard</h1>
        <p className="mt-2 text-base opacity-70">
          Hvor fort alle kom inn, og hvor mye som måtte rettes i døra.
        </p>
      </header>

      <RangePicker
        range={range}
        today={today}
        activeDays={dashboard?.activeDays ?? []}
        onChange={pick}
      />

      {query.isError && !dashboard ? (
        <p className="text-[var(--color-bg-danger)]">Klarte ikke å hente tallene. Prøv igjen.</p>
      ) : dashboard ? (
        <div
          className={cn(
            "flex flex-col gap-6 transition-opacity",
            query.isPlaceholderData && "opacity-60",
          )}
        >
          <DashboardBody
            dashboard={dashboard}
            interval={interval}
            onInterval={setInterval}
            onLatestDay={(day) => pick({ from: day, to: day })}
          />
        </div>
      ) : null}
    </main>
  )
}

function RangePicker({
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
  const single = range.from === range.to
  const latest = activeDays.at(-1)

  const presets: { label: string; range: DashboardRange }[] = [
    ...(latest ? [{ label: "Siste innsjekkdag", range: { from: latest, to: latest } }] : []),
    { label: "I dag", range: { from: today, to: today } },
    { label: "Siste 7 dager", range: { from: addDays(today, -6), to: today } },
    ...(activeDays.length > 1
      ? [{ label: "Alle innsjekkdager", range: { from: activeDays[0]!, to: latest! } }]
      : []),
  ]

  function choose(next: DashboardRange) {
    setOpen(false)
    onChange(next)
  }

  return (
    <div className="flex items-center gap-2">
      {single ? (
        <Button
          variant="surface"
          size="icon"
          aria-label="Dagen før"
          className="shrink-0"
          onClick={() => onChange({ from: addDays(range.from, -1), to: addDays(range.from, -1) })}
        >
          <ChevronLeft className="size-5" aria-hidden />
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
          <Button variant="surface" className="min-w-0 whitespace-nowrap">
            <CalendarDays className="size-5 shrink-0" aria-hidden />
            <span className="truncate">{rangeLabel(range)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <div className="flex flex-col gap-1 p-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => choose(preset.range)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="border-t border-white/10">
            <Calendar
              mode="range"
              locale={nb}
              weekStartsOn={1}
              defaultMonth={toLocalDate(range.from)}
              selected={draft ?? { from: toLocalDate(range.from), to: toLocalDate(range.to) }}
              modifiers={{ active: activeDays.map(toLocalDate) }}
              modifiersClassNames={{ active: "font-bold text-[var(--color-fg-brand)]" }}
              onSelect={(_, day) => {
                // First tap starts a new range; the second closes it.
                if (!draft?.from || draft.to) {
                  setDraft({ from: day })
                  return
                }
                const [from, to] = [draft.from, day].sort((a, b) => a.getTime() - b.getTime())
                choose({ from: fromLocalDate(from!), to: fromLocalDate(to!) })
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      {single ? (
        <Button
          variant="surface"
          size="icon"
          aria-label="Dagen etter"
          className="shrink-0"
          onClick={() => onChange({ from: addDays(range.from, 1), to: addDays(range.from, 1) })}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}

function DashboardBody({
  dashboard,
  interval: picked,
  onInterval,
  onLatestDay,
}: {
  dashboard: Dashboard
  interval: Interval | null
  onInterval: (interval: Interval) => void
  onLatestDay: (day: string) => void
}) {
  const times = checkInTimes(dashboard)
  const numbers = keyNumbers(times)
  const withDay = dashboard.range.from !== dashboard.range.to
  const nothing = times.length === 0 && dashboard.edits.total === 0 && dashboard.manual === 0

  if (nothing) {
    const latest = dashboard.activeDays.at(-1)
    const showLatest = latest && latest !== dashboard.range.from
    return (
      <section className="flex flex-col items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-6 py-10 text-center">
        <NoCheckInsIllustration className="max-w-64" />
        <h2 className="text-2xl">Ingen innsjekk i perioden</h2>
        {showLatest ? (
          <Button onClick={() => onLatestDay(latest)}>Vis siste innsjekkdag</Button>
        ) : (
          <Button asChild>
            <Link href="/">Til innsjekk</Link>
          </Button>
        )}
      </section>
    )
  }

  const interval = picked && fitsInterval(times, picked) ? picked : defaultInterval(times)
  const rows = buckets(times, interval)
  const start = rows[0]?.start ?? 0
  const end = rows.length > 0 ? rows.at(-1)!.start + interval * 60_000 : 0
  const share = dashboard.totalAttendees > 0 ? times.length / dashboard.totalAttendees : null

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-[var(--color-bg-surface)] px-5 py-4 sm:col-span-2 lg:row-span-2">
          <p className="text-sm opacity-70">Innsjekket</p>
          <p className="mt-1 font-sans text-6xl font-semibold">
            {numberFormat.format(times.length)}
          </p>
          <p className="mt-2 text-base opacity-70">
            av {numberFormat.format(dashboard.totalAttendees)} påmeldte
            {share != null ? ` · ${percentFormat.format(share)}` : null}
          </p>
          {share != null ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--color-fg-brand)]"
                style={{ width: `${Math.min(100, share * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
        <Tile
          label="Første og siste"
          value={
            numbers.first != null && numbers.last != null
              ? `${formatClock(numbers.first, withDay)}–${formatClock(numbers.last, withDay)}`
              : "–"
          }
        />
        <Tile
          label="Travleste minutt"
          value={numbers.peakMinute ? numberFormat.format(numbers.peakMinute.count) : "–"}
          detail={
            numbers.peakMinute
              ? `${withDay ? "" : "kl. "}${formatClock(numbers.peakMinute.start, withDay)}`
              : undefined
          }
        />
        <Tile
          label="Travleste kvarter"
          value={numbers.peakQuarter ? numberFormat.format(numbers.peakQuarter.count) : "–"}
          detail={
            numbers.peakQuarter
              ? `fra ${withDay ? "" : "kl. "}${formatClock(numbers.peakQuarter.start, withDay)}`
              : undefined
          }
        />
        <Tile
          label="Halvparten inne"
          // Over several days a duration from the very first check-in says nothing; show when.
          value={
            numbers.half == null || numbers.first == null
              ? "–"
              : withDay
                ? formatClock(numbers.half, true)
                : formatDuration(numbers.half - numbers.first)
          }
          detail={
            numbers.ninety == null || numbers.half == null || numbers.first == null
              ? undefined
              : withDay
                ? `90 % ${formatClock(numbers.ninety, true)}`
                : `kl. ${formatClock(numbers.half)} · 90 % etter ${formatDuration(numbers.ninety - numbers.first)}`
          }
        />
      </section>

      {rows.length > 0 ? (
        <section className="flex flex-col gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl">Innsjekk per {INTERVAL_LABELS[interval]}</h2>
              {numbers.perMinute != null && !withDay ? (
                <p className="text-sm opacity-70">
                  Snitt {numberFormat.format(Math.round(numbers.perMinute * 10) / 10)} i minuttet
                </p>
              ) : null}
            </div>
            <div className="flex gap-1">
              {INTERVALS.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={option === interval ? "default" : "ghost"}
                  aria-pressed={option === interval}
                  disabled={!fitsInterval(times, option)}
                  onClick={() => onInterval(option)}
                >
                  {INTERVAL_LABELS[option]}
                </Button>
              ))}
            </div>
          </div>
          <CheckInBars key={interval} rows={rows} interval={interval} withDay={withDay} />
          <h2 className="pt-2 text-2xl">Innsjekket totalt</h2>
          <CumulativeLine
            times={times}
            start={start}
            end={end}
            totalAttendees={dashboard.totalAttendees}
            withDay={withDay}
          />
          <BucketTable rows={rows} interval={interval} withDay={withDay} />
        </section>
      ) : null}

      <DoorFixes dashboard={dashboard} checkIns={times.length} />
      <Doors dashboard={dashboard} withDay={withDay} />
    </>
  )
}

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl bg-[var(--color-bg-surface)] px-5 py-4">
      <p className="text-sm opacity-70">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {detail ? <p className="mt-1 text-sm opacity-70">{detail}</p> : null}
    </div>
  )
}

/** How much attendee info had to be fixed: edits, names typed in, people not on the list. */
function DoorFixes({ dashboard, checkIns }: { dashboard: Dashboard; checkIns: number }) {
  const { edits } = dashboard
  const fields = [
    { label: "Navn", count: edits.name },
    { label: "Navn fylt inn", count: edits.namesFilled },
    { label: "Bedrift", count: edits.company },
    { label: "Stilling", count: edits.role },
  ]
  const most = Math.max(1, ...fields.map((field) => field.count))

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl">Rettet i døra</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Endringer"
          value={numberFormat.format(edits.total)}
          detail={`på ${numberFormat.format(edits.attendees)} deltakere`}
        />
        <Tile
          label="Andel rettet"
          value={checkIns > 0 ? percentFormat.format(edits.attendees / checkIns) : "–"}
          detail="av de innsjekkede"
        />
        <Tile
          label="Manuelle"
          value={numberFormat.format(dashboard.manual)}
          detail="sto ikke på listen"
        />
        <Tile
          label="Angret innsjekk"
          value={numberFormat.format(dashboard.undone)}
          detail="sjekket ut igjen"
        />
      </div>
      {edits.total > 0 ? (
        <div className="rounded-2xl bg-[var(--color-bg-surface)] px-5 py-4">
          <h3 className="text-base opacity-70">Hva ble rettet</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {fields.map((field) => (
              <li key={field.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3">
                <span className="text-sm">{field.label}</span>
                <span className="h-3 overflow-hidden rounded-full bg-white/5">
                  <span
                    className="block h-full rounded-r-[4px] bg-[var(--color-fg-brand)]"
                    style={{ width: `${(field.count / most) * 100}%` }}
                  />
                </span>
                <span className="text-right text-sm tabular-nums">
                  {numberFormat.format(field.count)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

/** Per printer (or admin login): who carried the queue. */
function Doors({ dashboard, withDay }: { dashboard: Dashboard; withDay: boolean }) {
  const rows = doorRows(dashboard)
  if (rows.length === 0) return null
  const most = Math.max(1, ...rows.map((row) => row.checkIns))
  const total = dashboard.checkIns.length

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl">Per printer</h2>
      <div className="overflow-x-auto rounded-2xl bg-[var(--color-bg-surface)]">
        <table className="w-full min-w-[40rem] text-sm tabular-nums">
          <thead className="text-left opacity-70">
            <tr>
              <th className="px-4 py-3 font-medium">Printer</th>
              <th className="px-4 py-3 font-medium">Innsjekk</th>
              <th className="px-4 py-3 text-right font-medium">Travleste minutt</th>
              <th className="px-4 py-3 text-right font-medium">Endringer</th>
              <th className="px-4 py-3 text-right font-medium">Manuelle</th>
              <th className="px-4 py-3 text-right font-medium">Første–siste</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-white/10">
                <td className="px-4 py-3 text-base break-words">{row.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 text-right">{numberFormat.format(row.checkIns)}</span>
                    <span className="h-2 w-28 overflow-hidden rounded-full bg-white/5">
                      <span
                        className="block h-full rounded-r-[4px] bg-[var(--color-fg-brand)]"
                        style={{ width: `${(row.checkIns / most) * 100}%` }}
                      />
                    </span>
                    {total > 0 ? (
                      <span className="opacity-60">
                        {percentFormat.format(row.checkIns / total)}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{numberFormat.format(row.peakMinute)}</td>
                <td className="px-4 py-3 text-right">{numberFormat.format(row.edits)}</td>
                <td className="px-4 py-3 text-right">{numberFormat.format(row.manual)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {row.first != null && row.last != null
                    ? `${formatClock(row.first, withDay)}–${formatClock(row.last, withDay)}`
                    : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
