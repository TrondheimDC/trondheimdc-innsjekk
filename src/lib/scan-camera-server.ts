import { cookies, headers } from "next/headers"
import { userAgent } from "next/server"
import { platformFromOsName } from "@/lib/platform"
import { SCAN_CAMERA_COOKIE, scanCameraDefault } from "@/lib/scan-camera"

/** Whether this device's door home is the camera scanner (`/`) or the search (`/sok`). */
export async function scanCameraEnabled(): Promise<boolean> {
  const stored = (await cookies()).get(SCAN_CAMERA_COOKIE)?.value
  if (stored === "1") return true
  if (stored === "0") return false
  const { os } = userAgent({ headers: await headers() })
  // A Mac UA may be an iPad; setup writes the cookie from the real device, so keep it scanning.
  return os.name === "Mac OS" || scanCameraDefault(platformFromOsName(os.name))
}
