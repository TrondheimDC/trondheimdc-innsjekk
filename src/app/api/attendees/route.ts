import { NextRequest, NextResponse } from "next/server"
import { attendeeRepository } from "@/lib/attendees"
import { isSession, requireDoorApiSession } from "@/lib/auth-api"
import {
  attendeeResponseSchema,
  attendeesSearchQuerySchema,
  attendeesSearchResponseSchema,
  manualAttendeeBodySchema,
} from "@/lib/db/schema"

export async function GET(request: NextRequest) {
  const session = await requireDoorApiSession()
  if (!isSession(session)) return session

  const parsed = attendeesSearchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    includeCheckedIn: request.nextUrl.searchParams.get("includeCheckedIn") === "1",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 })
  }

  const attendees = await attendeeRepository.search(parsed.data.q, {
    includeCheckedIn: parsed.data.includeCheckedIn,
  })
  return NextResponse.json(attendeesSearchResponseSchema.parse({ attendees }))
}

/** Manuell innsjekk: add someone who is not on the Checkin list. */
export async function POST(request: Request) {
  const session = await requireDoorApiSession()
  if (!isSession(session)) return session

  const body = manualAttendeeBodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const attendee = await attendeeRepository.createManual(body.data, {
    userId: session.user.id,
    name: session.user.name,
  })
  return NextResponse.json(attendeeResponseSchema.parse({ attendee }), { status: 201 })
}
