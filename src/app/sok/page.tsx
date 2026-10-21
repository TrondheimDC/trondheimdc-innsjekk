import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import type { Metadata } from "next"
import { attendeeRepository } from "@/lib/attendees"
import { scanCameraEnabled } from "@/lib/scan-camera-server"
import { SearchScreen } from "./search-screen"

export const metadata: Metadata = { title: "Søk" }

export default async function SearchPage() {
  const [stats, scanCamera] = await Promise.all([attendeeRepository.stats(), scanCameraEnabled()])
  const queryClient = new QueryClient()
  queryClient.setQueryData(["attendee-stats"], stats)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SearchScreen initialStats={stats} scanCamera={scanCamera} />
    </HydrationBoundary>
  )
}
