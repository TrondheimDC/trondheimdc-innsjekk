import { NextResponse } from "next/server"
import { z } from "zod"
import { attendeeRepository } from "@/lib/attendees"
import { isSession, requireDoorApiSession } from "@/lib/auth-api"
import { printEventBodySchema } from "@/lib/db/schema"

const idParamSchema = z.string().min(1).max(200)

/** Log a badge sent to the printer, so the dashboard can count reprints. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireDoorApiSession()
  if (!isSession(session)) return session

  const { id: rawId } = await context.params
  const id = idParamSchema.safeParse(decodeURIComponent(rawId))
  if (!id.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const body = printEventBodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const recorded = await attendeeRepository.recordPrint(id.data, body.data, {
    userId: session.user.id,
    name: session.user.name,
  })
  if (!recorded) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
