import type { Metadata } from "next"
import { headers } from "next/headers"
import { type AppInfo, SettingsScreen } from "@/components/settings-screen"
import { appBuildFromUserAgent } from "@/lib/android-app"
import { pendingAppUpdate } from "@/lib/app-release"
import { canAccessAdmin } from "@/lib/auth"
import { requireDoorSession } from "@/lib/auth-session"
import { isAppUserAgent } from "@/lib/platform"
import { scanCameraEnabled } from "@/lib/scan-camera-server"

export const metadata: Metadata = { title: "Innstillinger" }

export default async function InnstillingerPage() {
  const session = await requireDoorSession()
  return (
    <SettingsScreen
      printerName={session.user.name}
      scanCamera={await scanCameraEnabled()}
      app={await appInfo(canAccessAdmin(session.user.role))}
    />
  )
}

/** Version of the Android app, from its user agent; null in a browser. */
async function appInfo(admin: boolean): Promise<AppInfo | null> {
  const ua = (await headers()).get("user-agent") ?? ""
  if (!isAppUserAgent(ua)) return null
  const build = appBuildFromUserAgent(ua)
  const update = await pendingAppUpdate()
  return {
    version: build ? (build.versionName ?? String(build.versionCode)) : null,
    update: update ? (update.latest.versionName ?? String(update.latest.versionCode)) : null,
    admin,
  }
}
