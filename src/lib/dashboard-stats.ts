import { type Dashboard, EVENT_TIME_ZONE } from "./dashboard-data"

const MINUTE = 60_000

/** Chart intervals in minutes. */
export const INTERVALS = [1, 5, 15, 60] as const
export type Interval = (typeof INTERVALS)[number]

/** More bars than this and they turn into a smear. */
const MAX_BUCKETS = 720

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

export function fitsInterval(times: number[], interval: Interval): boolean {
  if (times.length === 0) return true
  const span = floorTo(times.at(-1)!, interval) - floorTo(times[0]!, interval)
  return span / (interval * MINUTE) + 1 <= MAX_BUCKETS || interval === 60
}

/** Five minutes reads as a smooth curve for a morning at the door; per minute is one tap away. */
export function defaultInterval(times: number[]): Interval {
  if (times.length === 0) return 5
  const minutes = (times.at(-1)! - times[0]!) / MINUTE
  if (minutes <= 720) return 5
  if (minutes <= 48 * 60) return 15
  return 60
}

/** Every interval from the first check-in to the last, empty ones included. */
export function buckets(times: number[], interval: Interval): Bucket[] {
  if (times.length === 0) return []
  const size = interval * MINUTE
  const first = floorTo(times[0]!, interval)
  const length = (floorTo(times.at(-1)!, interval) - first) / size + 1
  const rows: Bucket[] = Array.from({ length }, (_, i) => ({
    start: first + i * size,
    count: 0,
    total: 0,
  }))
  for (const time of times) rows[Math.floor((time - first) / size)]!.count += 1
  let total = 0
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

export interface DoorRow {
  key: string
  name: string
  checkIns: number
  edits: number
  manual: number
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
