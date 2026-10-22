"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { NoCheckInsIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import {
  type Dashboard,
  type DashboardRange,
  dashboardQueryKey,
  dashboardSchema,
  rangeSearch,
} from "@/lib/dashboard-data"
import {
  type Bucket,
  buckets,
  checkInTimes,
  DOORS_OPEN,
  type DoorRow,
  decimalFormat,
  defaultInterval,
  doorRows,
  fitsInterval,
  formatClock,
  formatDuration,
  INTERVALS,
  type Interval,
  keyNumbers,
  morning,
  morningSpan,
  numberFormat,
  PROGRAM_START,
  percentFormat,
  type Span,
  spanPerMinute,
} from "@/lib/dashboard-stats"
import { apiPath, cn } from "@/lib/utils"
import { type ChartMode, CheckInChart, type TooltipRow } from "./charts"
import { RangePicker } from "./range-picker"

async function fetchDashboard(range: DashboardRange): Promise<Dashboard> {
  const response = await fetch(apiPath(`/api/dashboard?${rangeSearch(range)}`))
  if (!response.ok) throw new Error("Klarte ikke å hente tallene")
  return dashboardSchema.parse(await response.json())
}

const INTERVAL_LABELS: Record<Interval, string> = {
  1: "1 min",
  5: "5 min",
  15: "15 min",
  60: "1 time",
}

/** The chart's time axis: doors open to program start, the whole range, or a stretch dragged out. */
type Zoom = "morning" | "all" | Span

const clockFormat = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
const OPEN_LABEL = clockFormat(DOORS_OPEN)
const PROGRAM_START_LABEL = clockFormat(PROGRAM_START)

export function DashboardView({
  initialRange,
  today,
}: {
  initialRange: DashboardRange
  today: string
}) {
  const [range, setRange] = useState(initialRange)
  const [interval, setInterval] = useState<Interval | null>(null)
  const [zoom, setZoom] = useState<Zoom | null>(null)

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
    setZoom(null)
    // Keep the address bar in sync so a refresh or a shared link shows the same days.
    const url = new URL(window.location.href)
    url.search = rangeSearch(next)
    window.history.replaceState(window.history.state, "", url)
  }

  const dashboard = query.data

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className="text-3xl">Dashboard</h1>
        <RangePicker
          range={range}
          today={today}
          activeDays={dashboard?.activeDays ?? []}
          onChange={pick}
        />
      </header>

      {query.isError && !dashboard ? (
        <p className="text-[var(--color-bg-danger)]">Klarte ikke å hente tallene. Prøv igjen.</p>
      ) : dashboard ? (
        <div
          className={cn(
            "flex flex-col gap-10 transition-opacity",
            query.isPlaceholderData && "opacity-60",
          )}
        >
          <DashboardBody
            dashboard={dashboard}
            interval={interval}
            onInterval={setInterval}
            zoom={zoom}
            onZoom={(next) => {
              setZoom(next)
              setInterval(null)
            }}
            onLatestDay={(day) => pick({ from: day, to: day })}
          />
        </div>
      ) : null}
    </main>
  )
}

/** A row of pill buttons with one picked, like the range and chart toggles. */
function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; disabled?: boolean }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <fieldset className="flex shrink-0 gap-0.5 rounded-xl bg-white/5 p-1">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <Button
          key={option.value}
          size="xs"
          variant="ghost"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          className={cn(
            "h-7 px-2.5 text-xs opacity-60 hover:bg-white/10 hover:opacity-100",
            option.value === value && "bg-white/10 opacity-100",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </fieldset>
  )
}

/** Small sans heading, so the numbers stay the loudest thing on the page. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm" style={{ fontFamily: "var(--font-family-sans)", fontWeight: 600 }}>
      {children}
    </h2>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs opacity-60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {detail ? <p className="text-xs opacity-50">{detail}</p> : null}
    </div>
  )
}

function DashboardBody({
  dashboard,
  interval: picked,
  onInterval,
  zoom: pickedZoom,
  onZoom,
  onLatestDay,
}: {
  dashboard: Dashboard
  interval: Interval | null
  onInterval: (interval: Interval) => void
  zoom: Zoom | null
  onZoom: (zoom: Zoom) => void
  onLatestDay: (day: string) => void
}) {
  const [mode, setMode] = useState<ChartMode>("interval")
  const times = checkInTimes(dashboard)
  const numbers = keyNumbers(times)
  const withDay = dashboard.range.from !== dashboard.range.to
  const nothing =
    times.length === 0 &&
    dashboard.edits.total === 0 &&
    dashboard.manual === 0 &&
    dashboard.prints.total === 0

  if (nothing) {
    const latest = dashboard.activeDays.at(-1)
    const showLatest = latest && latest !== dashboard.range.from
    return (
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 px-6 py-10 text-center">
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

  const now = Date.parse(dashboard.readAt)
  const doorsOpen = withDay ? null : morningSpan(dashboard.range.from)
  // The hour before the program starts is what the door is for: start there when anything happened in it.
  const zoom =
    pickedZoom ??
    (doorsOpen && times.some((time) => time >= doorsOpen.start && time < doorsOpen.end)
      ? "morning"
      : "all")
  const span: Span | undefined =
    zoom === "morning" ? (doorsOpen ?? undefined) : zoom === "all" ? undefined : zoom
  const interval =
    picked && fitsInterval(times, picked, span) ? picked : defaultInterval(times, span)
  // A live morning stops at now instead of drawing the rest of the hour as zero.
  const rows = span
    ? buckets(times, interval, { ...span, end: Math.min(span.end, now) })
    : buckets(times, interval)
  const axis =
    span ??
    (rows.length > 0
      ? { start: rows[0]!.start, end: rows.at(-1)!.start + interval * 60_000 }
      : { start: 0, end: 1 })
  const perMinute = span ? spanPerMinute(times, span, now) : withDay ? null : numbers.perMinute
  const rush = morning(times, now)
  const doors = doorRows(dashboard)
  const doorNames = new Map(doors.map((door) => [door.key, door.name]))
  const share = dashboard.totalAttendees > 0 ? times.length / dashboard.totalAttendees : null
  const size = interval * 60_000

  function breakdown(bucket: Bucket): TooltipRow[] {
    const counts = new Map<string, number>()
    for (const checkIn of dashboard.checkIns) {
      const at = Date.parse(checkIn.at)
      if (at < bucket.start || at >= bucket.start + size) continue
      counts.set(checkIn.door, (counts.get(checkIn.door) ?? 0) + 1)
    }
    return [...counts]
      .map(([key, count]) => ({ name: doorNames.get(key) ?? "Ukjent", count }))
      .sort((a, b) => b.count - a.count)
  }

  const marks =
    numbers.half != null && numbers.ninety != null
      ? [
          { label: `50 % · ${formatClock(numbers.half, withDay)}`, at: numbers.half, share: 0.5 },
          {
            label: `90 % · ${formatClock(numbers.ninety, withDay)}`,
            at: numbers.ninety,
            share: 0.9,
          },
        ]
          .map((mark) => ({ ...mark, value: Math.ceil(times.length * mark.share) }))
          .filter((mark) => mark.at >= axis.start && mark.at < axis.end)
      : []

  // Over several days a duration says nothing; show when. On one day, count from the doors
  // opening, so a test badge at 07:20 does not stretch it.
  const reached = (at: number | null) =>
    at == null || numbers.first == null
      ? { value: "–" }
      : withDay
        ? { value: formatClock(at, true) }
        : {
            value: formatDuration(
              at - (doorsOpen && at >= doorsOpen.start ? doorsOpen.start : numbers.first),
            ),
            detail: `kl. ${formatClock(at)}`,
          }
  const clock = (at: number) => `${withDay ? "" : "kl. "}${formatClock(at, withDay)}`

  return (
    <>
      <section className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-5xl font-semibold">{numberFormat.format(times.length)}</p>
            <p className="mt-1 text-xs opacity-60">
              innsjekket
              {share != null
                ? ` · ${percentFormat.format(share)} av ${numberFormat.format(dashboard.totalAttendees)} påmeldte`
                : null}
            </p>
          </div>
          <DoorList doors={doors} total={times.length} />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <SectionTitle>
                {mode === "interval"
                  ? `Innsjekk per ${INTERVAL_LABELS[interval]}`
                  : "Innsjekket totalt"}
              </SectionTitle>
              {perMinute != null ? (
                <p className="text-xs opacity-50">
                  Snitt {decimalFormat.format(perMinute)} i minuttet
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Segmented
                label="Tidsrom"
                value={typeof zoom === "string" ? zoom : "zoom"}
                onChange={(next) => {
                  if (next !== "zoom") onZoom(next)
                }}
                options={[
                  ...(doorsOpen
                    ? [{ value: "morning" as const, label: `${OPEN_LABEL}–${PROGRAM_START_LABEL}` }]
                    : []),
                  { value: "all" as const, label: withDay ? "Hele perioden" : "Hele dagen" },
                  ...(typeof zoom === "string"
                    ? []
                    : [{ value: "zoom" as const, label: "Utvalg" }]),
                ]}
              />
              <Segmented
                label="Visning"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "interval", label: "Per intervall" },
                  { value: "total", label: "Totalt" },
                ]}
              />
              <Segmented
                label="Intervall"
                value={interval}
                onChange={onInterval}
                options={INTERVALS.map((option) => ({
                  value: option,
                  label: INTERVAL_LABELS[option],
                  disabled: !fitsInterval(times, option, span),
                }))}
              />
            </div>
          </div>
          <CheckInChart
            key={`${mode}-${interval}-${axis.start}-${axis.end}`}
            rows={rows}
            span={axis}
            onZoom={onZoom}
            interval={interval}
            mode={mode}
            withDay={withDay}
            marks={marks}
            breakdown={breakdown}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle>Før og etter programstart</SectionTitle>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
          <Stat
            label={`Inne før ${PROGRAM_START_LABEL}`}
            value={numberFormat.format(rush.early + rush.rush)}
            detail={
              times.length > 0
                ? `${percentFormat.format((rush.early + rush.rush) / times.length)} av innsjekkede`
                : undefined
            }
          />
          <Stat
            label={`Snitt ${OPEN_LABEL}–${PROGRAM_START_LABEL}`}
            value={rush.perMinute != null ? decimalFormat.format(rush.perMinute) : "–"}
            detail="i minuttet"
          />
          <Stat
            label="Etternølere"
            value={numberFormat.format(rush.late)}
            detail={
              times.length > 0
                ? `${percentFormat.format(rush.late / times.length)} · etter ${PROGRAM_START_LABEL}`
                : `etter ${PROGRAM_START_LABEL}`
            }
          />
          <Stat
            label={`Før ${OPEN_LABEL}`}
            value={numberFormat.format(rush.early)}
            detail="før dørene åpnet"
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle>Tempo</SectionTitle>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Første innsjekk"
            value={numbers.first != null ? formatClock(numbers.first, withDay) : "–"}
          />
          <Stat
            label="Siste innsjekk"
            value={numbers.last != null ? formatClock(numbers.last, withDay) : "–"}
          />
          <Stat
            label="Travleste minutt"
            value={numbers.peakMinute ? numberFormat.format(numbers.peakMinute.count) : "–"}
            detail={numbers.peakMinute ? clock(numbers.peakMinute.start) : undefined}
          />
          <Stat
            label="Travleste kvarter"
            value={numbers.peakQuarter ? numberFormat.format(numbers.peakQuarter.count) : "–"}
            detail={numbers.peakQuarter ? `fra ${clock(numbers.peakQuarter.start)}` : undefined}
          />
          <Stat label="Halvparten inne" {...reached(numbers.half)} />
          <Stat label="90 % inne" {...reached(numbers.ninety)} />
        </div>
      </section>

      <DoorFixes dashboard={dashboard} checkIns={times.length} />
      <Breakdown
        doors={doors}
        rows={rows}
        interval={interval}
        withDay={withDay}
        total={times.length}
      />
    </>
  )
}

/** Hero sidebar: who carried the queue, busiest first. */
function DoorList({ doors, total }: { doors: DoorRow[]; total: number }) {
  const shown = doors.filter((door) => door.checkIns > 0).slice(0, 5)
  if (shown.length === 0) return null
  return (
    <ul className="flex flex-col gap-4">
      {shown.map((door) => {
        const share = total > 0 ? door.checkIns / total : 0
        return (
          <li key={door.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm">{door.name}</span>
              <span className="text-sm font-semibold tabular-nums">
                {numberFormat.format(door.checkIns)}
              </span>
            </div>
            <p className="text-xs opacity-50">
              {percentFormat.format(share)} · {numberFormat.format(door.edits)}{" "}
              {door.edits === 1 ? "endring" : "endringer"}
            </p>
            <div className="mt-1.5 h-0.5 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-[var(--color-fg-brand)]"
                style={{ width: `${share * 100}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const FIELD_SHADES = ["bg-white/90", "bg-white/60", "bg-white/40", "bg-white/20"]

/** How much attendee info had to be fixed: edits, names typed in, people not on the list. */
function DoorFixes({ dashboard, checkIns }: { dashboard: Dashboard; checkIns: number }) {
  const { edits } = dashboard
  const fields = [
    { label: "Navn", count: edits.name },
    { label: "Navn fylt inn", count: edits.namesFilled },
    { label: "Bedrift", count: edits.company },
    { label: "Stilling", count: edits.role },
  ]
  const changed = fields.reduce((sum, field) => sum + field.count, 0)

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>Rettet i døra</SectionTitle>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Endringer"
          value={numberFormat.format(edits.total)}
          detail={`på ${numberFormat.format(edits.attendees)} deltakere`}
        />
        <Stat
          label="Andel rettet"
          value={checkIns > 0 ? percentFormat.format(edits.attendees / checkIns) : "–"}
          detail="av de innsjekkede"
        />
        <Stat
          label="Navn fylt inn"
          value={numberFormat.format(edits.namesFilled)}
          detail="billett uten navn"
        />
        <Stat
          label="Manuelle"
          value={numberFormat.format(dashboard.manual)}
          detail="sto ikke på listen"
        />
        <Stat
          label="Skrevet ut på nytt"
          value={numberFormat.format(dashboard.prints.reprints)}
          detail={`for ${numberFormat.format(dashboard.prints.attendeesReprinted)} deltakere`}
        />
        <Stat
          label="Angret innsjekk"
          value={numberFormat.format(dashboard.undone)}
          detail="sjekket ut igjen"
        />
      </div>
      {changed > 0 ? (
        <div className="mt-2 flex max-w-xl flex-col gap-2.5">
          <p className="text-xs opacity-60">Hva ble rettet</p>
          <div className="flex h-2 gap-0.5">
            {fields.map((field, i) =>
              field.count > 0 ? (
                <div
                  key={field.label}
                  className={cn("h-full rounded-full", FIELD_SHADES[i])}
                  style={{ width: `${(field.count / changed) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {fields.map((field, i) => (
              <li key={field.label} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-sm", FIELD_SHADES[i])} aria-hidden />
                <span className="opacity-60">{field.label}</span>
                <span className="font-semibold tabular-nums">
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

/** Per printer, or per interval: the same numbers as the chart, for reading without hovering. */
function Breakdown({
  doors,
  rows,
  interval,
  withDay,
  total,
}: {
  doors: DoorRow[]
  rows: Bucket[]
  interval: Interval
  withDay: boolean
  total: number
}) {
  const [view, setView] = useState<"printer" | "time">("printer")
  const size = interval * 60_000
  const most = Math.max(1, ...rows.map((row) => row.count))
  const head = "px-2 py-2 text-xs font-normal opacity-50"
  const cell = "px-2 py-3"

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Fordeling</SectionTitle>
        <Segmented
          label="Fordeling"
          value={view}
          onChange={setView}
          options={[
            { value: "printer", label: "Printer" },
            { value: "time", label: "Tid" },
          ]}
        />
      </div>
      {view === "printer" ? (
        <table className="w-full text-sm tabular-nums">
          <thead className="border-b border-white/10 text-left">
            <tr>
              <th className={cn(head, "w-8")}>#</th>
              <th className={head}>Printer</th>
              <th className={cn(head, "text-right")}>Innsjekk</th>
              <th className={cn(head, "text-right")}>Andel</th>
              <th className={cn(head, "hidden text-right sm:table-cell")}>Travleste minutt</th>
              <th className={cn(head, "hidden text-right sm:table-cell")}>Endringer</th>
              <th className={cn(head, "hidden text-right sm:table-cell")}>Manuelle</th>
              <th className={cn(head, "hidden text-right sm:table-cell")}>På nytt</th>
              <th className={cn(head, "hidden text-right md:table-cell")}>Første–siste</th>
            </tr>
          </thead>
          <tbody>
            {doors.map((door, i) => (
              <tr key={door.key} className="border-b border-white/5">
                <td className={cn(cell, "opacity-50")}>{i + 1}</td>
                <td className={cell}>
                  <span className="break-words">{door.name}</span>
                  <div className="mt-1.5 h-0.5 max-w-48 rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-[var(--color-fg-brand)]"
                      style={{ width: `${total > 0 ? (door.checkIns / total) * 100 : 0}%` }}
                    />
                  </div>
                </td>
                <td className={cn(cell, "text-right font-semibold")}>
                  {numberFormat.format(door.checkIns)}
                </td>
                <td className={cn(cell, "text-right opacity-60")}>
                  {total > 0 ? percentFormat.format(door.checkIns / total) : "–"}
                </td>
                <td className={cn(cell, "hidden text-right opacity-60 sm:table-cell")}>
                  {numberFormat.format(door.peakMinute)}
                </td>
                <td className={cn(cell, "hidden text-right opacity-60 sm:table-cell")}>
                  {numberFormat.format(door.edits)}
                </td>
                <td className={cn(cell, "hidden text-right opacity-60 sm:table-cell")}>
                  {numberFormat.format(door.manual)}
                </td>
                <td className={cn(cell, "hidden text-right opacity-60 sm:table-cell")}>
                  {numberFormat.format(door.reprints)}
                </td>
                <td
                  className={cn(
                    cell,
                    "hidden text-right whitespace-nowrap opacity-60 md:table-cell",
                  )}
                >
                  {door.first != null && door.last != null
                    ? `${formatClock(door.first, withDay)}–${formatClock(door.last, withDay)}`
                    : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 border-b border-white/10 bg-[var(--color-bg-base)] text-left">
              <tr>
                <th className={head}>Tid</th>
                <th className={cn(head, "text-right")}>Innsjekk</th>
                <th className={cn(head, "text-right")}>Totalt</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((row) => row.count > 0)
                .map((row) => (
                  <tr key={row.start} className="border-b border-white/5">
                    <td className={cell}>
                      {interval === 1
                        ? formatClock(row.start, withDay)
                        : `${formatClock(row.start, withDay)}–${formatClock(row.start + size)}`}
                      <div className="mt-1.5 h-0.5 max-w-48 rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-[var(--color-fg-brand)]"
                          style={{ width: `${(row.count / most) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className={cn(cell, "text-right font-semibold")}>
                      {numberFormat.format(row.count)}
                    </td>
                    <td className={cn(cell, "text-right opacity-60")}>
                      {numberFormat.format(row.total)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
