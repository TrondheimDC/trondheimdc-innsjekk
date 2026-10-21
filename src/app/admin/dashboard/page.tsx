import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import type { Metadata } from "next"
import { loadDashboard, resolveRange } from "@/lib/dashboard"
import { dashboardQueryKey, dashboardQuerySchema, osloDate } from "@/lib/dashboard-data"
import { DashboardView } from "./dashboard"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ fra?: string; til?: string }>
}) {
  const query = dashboardQuerySchema.safeParse(await searchParams)
  const range = await resolveRange(query.success ? query.data : {})
  const dashboard = await loadDashboard(range)
  const queryClient = new QueryClient()
  queryClient.setQueryData(dashboardQueryKey(range), dashboard)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardView initialRange={range} today={osloDate(new Date())} />
    </HydrationBoundary>
  )
}
