import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Scanner } from "@/components/scanner"
import { requireDoorSession } from "@/lib/auth-session"
import { scanCameraEnabled } from "@/lib/scan-camera-server"
import { SETUP_SEEN_COOKIE } from "@/lib/setup-seen"

export default async function HomePage() {
  const session = await requireDoorSession()
  // Decide before the first paint, so a fresh device never flashes the scanner on its way to setup.
  if (!(await cookies()).has(SETUP_SEEN_COOKIE)) redirect("/oppsett")
  // Camera off (a PC at the door): the search is home.
  if (!(await scanCameraEnabled())) redirect("/sok")
  return <Scanner printerName={session.user.name} />
}
