import { cookies, headers } from "next/headers"
import { userAgent } from "next/server"
import { platformFromOsName } from "@/lib/platform"
import { SCAN_CAMERA_COOKIE, scanCameraDefault } from "@/lib/scan-camera"

/** What this device chose (setup or Innstillinger); null before it has chosen. */
export async function storedScanCamera(): Promise<boolean | null> {
  const stored = (await cookies()).get(SCAN_CAMERA_COOKIE)?.value
  return stored === "1" ? true : stored === "0" ? false : null
}

/** Whether this device's door home is the camera scanner (`/`) or the search (`/sok`). */
export async function scanCameraEnabled(): Promise<boolean> {
  const stored = await storedScanCamera()
  if (stored !== null) return stored
  const { os } = userAgent({ headers: await headers() })
  // A Mac UA may be an iPad; setup writes the cookie from the real device, so keep it scanning.
  return os.name === "Mac OS" || scanCameraDefault(platformFromOsName(os.name))
}
