import { type PhonePlatform, platformFromNavigator } from "@/lib/platform"

/**
 * "1" / "0": whether `/` is the camera scanner. Off makes the search the door's home, for a
 * PC/Mac without a usable camera. A cookie, so the server picks the home before it paints.
 */
export const SCAN_CAMERA_COOKIE = "tdc-scan-camera-on"

/** Phones scan; a PC/Mac searches until someone turns the camera on. */
export function scanCameraDefault(platform: PhonePlatform): boolean {
  return platform !== "other"
}

export function setScanCamera(on: boolean) {
  document.cookie = `${SCAN_CAMERA_COOKIE}=${on ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`
}

/** On finishing setup: pick the default from the real device (iPadOS reports as a Mac). */
export function initScanCamera() {
  if (document.cookie.split("; ").some((part) => part.startsWith(`${SCAN_CAMERA_COOKIE}=`))) return
  setScanCamera(scanCameraDefault(platformFromNavigator()))
}
