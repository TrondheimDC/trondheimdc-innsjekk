import { NextResponse } from "next/server"
import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import { loadDashboard, resolveRange } from "@/lib/dashboard"
import { dashboardQuerySchema, dashboardSchema } from "@/lib/dashboard-data"

export async function GET(request: Request) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const params = new URL(request.url).searchParams
  const query = dashboardQuerySchema.safeParse({
    fra: params.get("fra") ?? undefined,
    til: params.get("til") ?? undefined,
  })
  if (!query.success) return NextResponse.json({ error: "invalid_range" }, { status: 400 })

  const dashboard = await loadDashboard(await resolveRange(query.data))
  return NextResponse.json(dashboardSchema.parse(dashboard))
}
