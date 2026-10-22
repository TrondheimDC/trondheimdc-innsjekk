import { type Dashboard, EVENT_TIME_ZONE, osloDate, osloInstant } from "./dashboard-data"

const MINUTE = 60_000

/** Chart intervals in minutes. */
export const INTERVALS = [1, 5, 15, 60] as const
export type Interval = (typeof INTERVALS)[number]

/** More bars than this and they turn into a smear. */
const MAX_BUCKETS = 720

/**
 * Doors open at 08:00 and the program starts at 09:00 (Oslo): the hour the door is for.
 * Fixed for TDC until there is an event to store them on (docs/TODO.md).
 */
export const DOORS_OPEN = 8 * 60
export const PROGRAM_START = 9 * 60

/** `[start, end)` instants. */
export interface Span {
  start: number
  end: number
}

export interface Bucket {
  start: number
  count: number
  /** Checked in by the end of this bucket. */
  total: number
}

/** Check-in instants (ms), oldest first. */
export function checkInTimes(dashboard: Dashboard): number[] {
  return dashboard.checkIns.map((checkIn) => Date.parse(checkIn.at)).sort((a, b) => a - b)
}

/** Whole-hour Oslo offsets keep every interval up to an hour on the Oslo clock. */
function floorTo(ms: number, interval: Interval) {
  const size = interval * MINUTE
  return Math.floor(ms / size) * size
}

/** The span to chart: the one picked, else first to last check-in. */
function extent(times: number[], span?: Span): Span | null {
  if (span) return span
  return times.length === 0 ? null : { start: times[0]!, end: times.at(-1)! + 1 }
}

export function fitsInterval(times: number[], interval: Interval, span?: Span): boolean {
  const range = extent(times, span)
  if (!range) return true
  const length = floorTo(range.end - 1, interval) - floorTo(range.start, interval)
  return length / (interval * MINUTE) + 1 <= MAX_BUCKETS || interval === 60
}

/** Five minutes reads as a smooth curve for a morning at the door; per minute is one tap away. */
export function defaultInterval(times: number[], span?: Span): Interval {
  const range = extent(times, span)
  if (!range) return 5
  const minutes = (range.end - range.start) / MINUTE
  if (minutes <= 30) return 1
  if (minutes <= 720) return 5
  if (minutes <= 48 * 60) return 15
  return 60
}

/**
 * Every interval across the span (default: first check-in to last), empty ones included.
 * The running total counts check-ins before the span too.
 */
export function buckets(times: number[], interval: Interval, span?: Span): Bucket[] {
  const range = extent(times, span)
  if (!range) return []
  const size = interval * MINUTE
  const first = floorTo(range.start, interval)
  const length = Math.max(0, (floorTo(range.end - 1, interval) - first) / size + 1)
  const rows: Bucket[] = Array.from({ length }, (_, i) => ({
    start: first + i * size,
    count: 0,
    total: 0,
  }))
  let total = 0
  for (const time of times) {
    if (time < first) total += 1
    else {
      const row = rows[Math.floor((time - first) / size)]
      if (row) row.count += 1
    }
  }
  for (const row of rows) {
    total += row.count
    row.total = total
  }
  return rows
}

export interface KeyNumbers {
  count: number
  first: number | null
  last: number | null
  /** Busiest single clock minute. */
  peakMinute: { start: number; count: number } | null
  /** Busiest 15 minutes, any start. */
  peakQuarter: { start: number; count: number } | null
  /** When half / 90 % of the range's check-ins were in. */
  half: number | null
  ninety: number | null
  perMinute: number | null
}

export function keyNumbers(times: number[]): KeyNumbers {
  const count = times.length
  if (count === 0) {
    return {
      count,
      first: null,
      last: null,
      peakMinute: null,
      peakQuarter: null,
      half: null,
      ninety: null,
      perMinute: null,
    }
  }
  const first = times[0]!
  const last = times.at(-1)!

  let peakMinute = { start: first, count: 0 }
  for (const bucket of buckets(times, 1)) {
    if (bucket.count > peakMinute.count) peakMinute = { start: bucket.start, count: bucket.count }
  }

  let peakQuarter = { start: first, count: 0 }
  let tail = 0
  for (let head = 0; head < count; head += 1) {
    while (times[head]! - times[tail]! >= 15 * MINUTE) tail += 1
    if (head - tail + 1 > peakQuarter.count) {
      peakQuarter = { start: times[tail]!, count: head - tail + 1 }
    }
  }

  const minutes = (last - first) / MINUTE
  return {
    count,
    first,
    last,
    peakMinute,
    peakQuarter,
    half: times[Math.ceil(count * 0.5) - 1]!,
    ninety: times[Math.ceil(count * 0.9) - 1]!,
    perMinute: minutes >= 1 ? count / minutes : null,
  }
}

/** 08:00–09:00 on an Oslo day. */
export function morningSpan(date: string): Span {
  return {
    start: osloInstant(date, DOORS_OPEN).getTime(),
    end: osloInstant(date, PROGRAM_START).getTime(),
  }
}

/** Check-ins per minute across a span, counting only the minutes that have passed by `now`. */
export function spanPerMinute(times: number[], span: Span, now: number): number | null {
  const minutes = (Math.min(span.end, now) - span.start) / MINUTE
  if (minutes < 1) return null
  return times.filter((time) => time >= span.start && time < span.end).length / minutes
}

export interface Morning {
  /** Before the doors opened at 08:00. */
  early: number
  /** 08:00–09:00. */
  rush: number
  /** From the program start at 09:00: the latecomers. */
  late: number
  /** Per minute between 08:00 and 09:00, over every day with check-ins. */
  perMinute: number | null
}

/** Before, during and after the hour from doors open to program start, on each check-in's own day. */
export function morning(times: number[], now: number): Morning {
  const result: Morning = { early: 0, rush: 0, late: 0, perMinute: null }
  const spans = new Map<string, Span>()
  for (const time of times) {
    const date = osloDate(new Date(time))
    let span = spans.get(date)
    if (!span) {
      span = morningSpan(date)
      spans.set(date, span)
    }
    if (time < span.start) result.early += 1
    else if (time < span.end) result.rush += 1
    else result.late += 1
  }
  let minutes = 0
  for (const span of spans.values()) {
    minutes += Math.max(0, Math.min(span.end, now) - span.start) / MINUTE
  }
  if (minutes >= 1) result.perMinute = result.rush / minutes
  return result
}

export interface DoorRow {
  key: string
  name: string
  checkIns: number
  edits: number
  manual: number
  reprints: number
  first: number | null
  last: number | null
  peakMinute: number
}

/** One row per printer or login, busiest first. */
export function doorRows(dashboard: Dashboard): DoorRow[] {
  const timesByDoor = new Map<string, number[]>()
  for (const checkIn of dashboard.checkIns) {
    const list = timesByDoor.get(checkIn.door) ?? []
    list.push(Date.parse(checkIn.at))
    timesByDoor.set(checkIn.door, list)
  }
  return dashboard.doors
    .map((door) => {
      const times = (timesByDoor.get(door.key) ?? []).sort((a, b) => a - b)
      const numbers = keyNumbers(times)
      return {
        ...door,
        checkIns: times.length,
        first: numbers.first,
        last: numbers.last,
        peakMinute: numbers.peakMinute?.count ?? 0,
      }
    })
    .sort(
      (a, b) => b.checkIns - a.checkIns || b.edits - a.edits || a.name.localeCompare(b.name, "nb"),
    )
}

const timeFormat = new Intl.DateTimeFormat("nb-NO", {
  timeZone: EVENT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
})
const dayTimeFormat = new Intl.DateTimeFormat("nb-NO", {
  timeZone: EVENT_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

/** `09:14`, or with the day in front when the range spans several days. */
export function formatClock(ms: number, withDay = false): string {
  return (withDay ? dayTimeFormat : timeFormat).format(ms)
}

/** `1 t 12 min`, `45 min`, `under 1 min`. */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / MINUTE)
  if (minutes < 1) return "under 1 min"
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} t` : `${hours} t ${rest} min`
}

export const numberFormat = new Intl.NumberFormat("nb-NO")
export const decimalFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 })
export const percentFormat = new Intl.NumberFormat("nb-NO", {
  style: "percent",
  maximumFractionDigits: 0,
})
