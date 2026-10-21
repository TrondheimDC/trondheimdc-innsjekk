import { attendeeResponseSchema } from "@/lib/db/schema"
import { apiPath } from "@/lib/utils"

/** The attendee as the door sees it now; null when the id is unknown or removed. */
export async function fetchAttendee(id: string) {
  const response = await fetch(apiPath(`/api/attendees/${encodeURIComponent(id)}`))
  if (response.status === 404) return null
  if (!response.ok) throw new Error("lookup failed")
  return attendeeResponseSchema.parse(await response.json()).attendee
}
