import { z } from "zod"

/** The event is in Trondheim: days, minutes and clock times are Oslo time whatever zone the host runs in. */
export const EVENT_TIME_ZONE = "Europe/Oslo"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** `?fra=2026-10-22&til=2026-10-22`, both Oslo dates, inclusive. Either may be left out. */
export const dashboardQuerySchema = z
  .object({ fra: isoDate.optional(), til: isoDate.optional() })
  .refine((query) => !query.fra || !query.til || query.fra <= query.til, {
    message: "fra må være før til",
  })

export const dashboardRangeSchema = z.object({ from: isoDate, to: isoDate })
export type DashboardRange = z.infer<typeof dashboardRangeSchema>

export const dashboardSchema = z.object({
  range: dashboardRangeSchema,
  /** Oslo dates with at least one counted check-in, oldest first (all time, not just the range). */
  activeDays: z.array(isoDate),
  /** Active attendees right now. */
  totalAttendees: z.number().int().nonnegative(),
  /** One per attendee: the check-in that still stands, when it falls inside the range. */
  checkIns: z.array(z.object({ at: z.string(), door: z.string() })),
  /** `out` events in the range: check-ins taken back at the door. */
  undone: z.number().int().nonnegative(),
  edits: z.object({
    total: z.number().int().nonnegative(),
    attendees: z.number().int().nonnegative(),
    name: z.number().int().nonnegative(),
    company: z.number().int().nonnegative(),
    role: z.number().int().nonnegative(),
    /** A ticket nobody filled out got its name at the door. */
    namesFilled: z.number().int().nonnegative(),
  }),
  /** Manuell innsjekk: people added at the door. */
  manual: z.number().int().nonnegative(),
  /** Badges sent to a printer (`print` events; none before they were logged). */
  prints: z.object({
    total: z.number().int().nonnegative(),
    /** Printed again for someone who already had a badge. */
    reprints: z.number().int().nonnegative(),
    attendeesReprinted: z.number().int().nonnegative(),
  }),
  /** Printers or logins that did anything in the range. `key` matches `checkIns[].door`. */
  doors: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      edits: z.number().int().nonnegative(),
      manual: z.number().int().nonnegative(),
      reprints: z.number().int().nonnegative(),
    }),
  ),
})
export type Dashboard = z.infer<typeof dashboardSchema>

export const dashboardQueryKey = (range: DashboardRange) =>
  ["dashboard", range.from, range.to] as const

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** `yyyy-mm-dd` of an instant in Oslo. */
export function osloDate(value: string | Date): string {
  return dateFormat.format(typeof value === "string" ? new Date(value) : value)
}

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
})

/** Oslo's offset from UTC (ms) at an instant. */
export function osloOffset(ms: number): number {
  const parts = Object.fromEntries(
    offsetFormat.formatToParts(new Date(ms)).map((part) => [part.type, Number(part.value)]),
  )
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return asUtc - Math.floor(ms / 1000) * 1000
}

/** The instant an Oslo day starts. */
export function osloDayStart(date: string): Date {
  const [year, month, day] = date.split("-").map(Number)
  const guess = Date.UTC(year!, month! - 1, day!)
  const first = guess - osloOffset(guess)
  // Re-check once: the guess and the real midnight can sit on either side of a DST switch.
  return new Date(guess - osloOffset(first))
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10)
}

/** `[start, end)` instants of an inclusive Oslo date range. */
export function rangeBounds(range: DashboardRange): { start: Date; end: Date } {
  return { start: osloDayStart(range.from), end: osloDayStart(addDays(range.to, 1)) }
}

export function rangeSearch(range: DashboardRange): string {
  return new URLSearchParams({ fra: range.from, til: range.to }).toString()
}
