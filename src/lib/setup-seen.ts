import { initScanCamera } from "@/lib/scan-camera"

/** Set once a device finishes /oppsett. A cookie, so `/` can send a fresh device to setup before it paints. */
export const SETUP_SEEN_COOKIE = "tdc-checkin-printer-seen"

export function markSetupSeen() {
  document.cookie = `${SETUP_SEEN_COOKIE}=1; path=/; max-age=31536000; samesite=lax`
  initScanCamera()
}
