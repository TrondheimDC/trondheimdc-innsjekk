import { and, asc, count, eq, gte, inArray, isNull, lt, max } from "drizzle-orm"
import { z } from "zod"
import { type Dashboard, type DashboardRange, osloDate, rangeBounds } from "./dashboard-data"
import { db } from "./db"
import { attendees, checkEvents, printers, user } from "./db/schema"

const badgeFieldsSchema = z.object({
  name: z.string().nullable(),
  company: z.string().nullable(),
  role: z.string().nullable(),
})
const correctDetailSchema = z.object({ from: badgeFieldsSchema, to: badgeFieldsSchema })

type Actor = { actorUserId: string | null; actorName: string | null }

/**
 * Who did it, as the dashboard groups it: the printer behind a door login, else the login
 * (an admin), else the name stored on the event (the login was removed since).
 */
async function doorResolver(actors: Actor[]) {
  const userIds = [...new Set(actors.flatMap((actor) => actor.actorUserId ?? []))]
  const users =
    userIds.length === 0
      ? []
      : await db
          .select({
            id: user.id,
            name: user.name,
            printerId: user.printerId,
            printerName: printers.name,
          })
          .from(user)
          .leftJoin(printers, eq(printers.id, user.printerId))
          .where(inArray(user.id, userIds))
  const byId = new Map(users.map((row) => [row.id, row]))

  return (actor: Actor): { key: string; name: string } => {
    const row = actor.actorUserId ? byId.get(actor.actorUserId) : undefined
    if (row?.printerId) return { key: row.printerId, name: row.printerName ?? row.name }
    if (row) return { key: row.id, name: row.name }
    if (actor.actorUserId) return { key: actor.actorUserId, name: actor.actorName ?? "Ukjent" }
    return { key: "unknown", name: actor.actorName ?? "Ukjent" }
  }
}

/**
 * Check-in speed and door fixes for an Oslo date range, from `check_events`.
 * A check-in is the attendee's `in` that still stands (not taken back by a later `out`), so
 * everyone counts once. `attendees.correctedAt` only says who is corrected now; the edits come
 * from the `correct` events instead.
 */
export async function loadDashboard(range: DashboardRange): Promise<Dashboard> {
  const { start, end } = rangeBounds(range)
  const from = start.toISOString()
  const to = end.toISOString()

  // All time: an `in` inside the range can be undone after it.
  const toggles = await db
    .select({
      attendeeId: checkEvents.attendeeId,
      action: checkEvents.action,
      createdAt: checkEvents.createdAt,
      actorUserId: checkEvents.actorUserId,
      actorName: checkEvents.actorName,
    })
    .from(checkEvents)
    .where(inArray(checkEvents.action, ["in", "out"]))
    .orderBy(asc(checkEvents.createdAt), asc(checkEvents.id))

  const latest = new Map<string, (typeof toggles)[number]>()
  for (const event of toggles) latest.set(event.attendeeId, event)
  const standing = [...latest.values()]
    .filter((event) => event.action === "in")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const inRange = standing.filter((event) => event.createdAt >= from && event.createdAt < to)
  const undone = toggles.filter(
    (event) => event.action === "out" && event.createdAt >= from && event.createdAt < to,
  ).length

  const fixes = await db
    .select({
      attendeeId: checkEvents.attendeeId,
      action: checkEvents.action,
      detail: checkEvents.detail,
      actorUserId: checkEvents.actorUserId,
      actorName: checkEvents.actorName,
    })
    .from(checkEvents)
    .where(
      and(
        inArray(checkEvents.action, ["correct", "create"]),
        gte(checkEvents.createdAt, from),
        lt(checkEvents.createdAt, to),
      ),
    )

  const resolveDoor = await doorResolver([...inRange, ...fixes])
  const doors = new Map<string, Dashboard["doors"][number]>()
  const door = (actor: Actor) => {
    const { key, name } = resolveDoor(actor)
    let row = doors.get(key)
    if (!row) {
      row = { key, name, edits: 0, manual: 0 }
      doors.set(key, row)
    }
    return row
  }

  const edits = { total: 0, attendees: 0, name: 0, company: 0, role: 0, namesFilled: 0 }
  const edited = new Set<string>()
  let manual = 0
  for (const event of fixes) {
    if (event.action === "create") {
      manual += 1
      door(event).manual += 1
      continue
    }
    edits.total += 1
    edited.add(event.attendeeId)
    door(event).edits += 1
    const parsed = correctDetailSchema.safeParse(event.detail ? JSON.parse(event.detail) : null)
    if (!parsed.success) continue
    const { from: before, to: after } = parsed.data
    if (before.name == null && after.name != null) edits.namesFilled += 1
    else if (before.name !== after.name) edits.name += 1
    if (before.company !== after.company) edits.company += 1
    if (before.role !== after.role) edits.role += 1
  }
  edits.attendees = edited.size

  const checkIns = inRange.map((event) => ({ at: event.createdAt, door: door(event).key }))

  const [total] = await db
    .select({ count: count() })
    .from(attendees)
    .where(isNull(attendees.deletedAt))

  return {
    range,
    activeDays: [...new Set(standing.map((event) => osloDate(event.createdAt)))].sort(),
    totalAttendees: total?.count ?? 0,
    checkIns,
    undone,
    edits,
    manual,
    doors: [...doors.values()],
  }
}

/**
 * The Oslo day of the latest check-in that still stands (usually the event day), or today
 * before the first one. `checked_in_at` is that `in` event's time until an `out` clears it.
 */
export async function latestCheckInDay(): Promise<string> {
  const [row] = await db
    .select({ at: max(checkEvents.createdAt) })
    .from(checkEvents)
    .innerJoin(attendees, eq(attendees.id, checkEvents.attendeeId))
    .where(and(eq(checkEvents.action, "in"), eq(attendees.checkedInAt, checkEvents.createdAt)))
  return osloDate(row?.at ?? new Date())
}

/** `?fra`/`?til` as a range: one date alone is that day; neither is the latest check-in day. */
export async function resolveRange(query: { fra?: string; til?: string }): Promise<DashboardRange> {
  const from = query.fra ?? query.til
  const to = query.til ?? query.fra
  if (from && to) return { from, to }
  const day = await latestCheckInDay()
  return { from: day, to: day }
}
