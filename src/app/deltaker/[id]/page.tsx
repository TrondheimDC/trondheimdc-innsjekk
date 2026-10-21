import type { Metadata } from "next"
import { AttendeeScreen } from "@/components/attendee-screen"
import { FROM_PARAM, PRINT_NOW_PARAM } from "@/lib/attendee-path"
import { requireDoorSession } from "@/lib/auth-session"
import { scanCameraEnabled } from "@/lib/scan-camera-server"

export const metadata: Metadata = { title: "Deltaker" }

export default async function AttendeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireDoorSession()
  const { id } = await params
  const query = await searchParams
  return (
    <AttendeeScreen
      id={decodeURIComponent(id)}
      scanCamera={await scanCameraEnabled()}
      fromSearch={query[FROM_PARAM] === "sok"}
      printNow={query[PRINT_NOW_PARAM] === "1"}
    />
  )
}
