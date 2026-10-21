"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { attendeeResponseSchema, type ManualAttendeeBody } from "@/lib/db/schema"
import { apiPath } from "@/lib/utils"

/** Manuell innsjekk: add someone who is not on the Checkin list. */
export function useCreateAttendee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: ManualAttendeeBody) => {
      const response = await fetch(apiPath("/api/attendees"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error("create failed")
      const body = attendeeResponseSchema.parse(await response.json())
      return body.attendee
    },
    onSuccess: (attendee) => {
      queryClient.setQueryData(["attendee", attendee.id], attendee)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendee-stats"] })
      void queryClient.invalidateQueries({ queryKey: ["search"] })
    },
  })
}
