# Android app

A Capacitor shell around the hosted check-in app, with its own Bluetooth printing. On Android there is no Smooth Print and no `brotherwebprint://`. iPhones still use Smooth Print.

## How it works

- The WebView loads `https://innsjekk.trondheimdc.no` (`server.url` in `capacitor.config.ts`). Pages, login and the database are the same as in the browser.
- The app appends `TDCInnsjekkApp` to the user agent. `isAppUserAgent` → print method `app`, on the server (first paint) and in the client.
- `LabelPrinterPlugin.java` is a raw Bluetooth Classic (SPP/RFCOMM) pipe to the printer's MAC. It only moves bytes.
- `src/lib/app-printer.ts` wraps the plugin as a `Transport` for `WebBrotherQLPrinter`, which is the same encoder, status checks and media checks as WebUSB (`src/lib/label-printer.ts`). The badge is drawn by `badge-render.ts`, the same as on PC/Mac.
- `/oppsett` in the app: printer Bluetooth on → **Skann QR** → **Koble til printeren** (Android shows its own pairing code the first time) → test print. **Manuelt oppsett** lists QL printers the phone has already paired with.
- The app remembers the last printer and reconnects on start when that printer is already paired. Opening the app does not start Android's pairing dialog; staff tap **Koble til** for that. A dropped link reconnects the same way before a print.

## Android in a browser

While the app is the active APK under Admin → Android-app, door pages in an Android browser (not the app) redirect to `/last-ned` after login (`redirectAndroidBrowserToApp` in `requireDoorSession`). The download sits behind door login, like the rest of the door. `/last-ned` offers:

- **Last ned appen**: the active APK from Admin → Android-app.
- **Åpne appen**: opens the app on the page that was asked for (e.g. a printer sticker), already logged in, or falls back to `/last-ned` when the app is missing.
- The install help (`/oppsett/android`, allow installs from the browser).

Admin pages still work in the browser.

### Rolling back to Smooth Print

The active APK is the switch; there is no separate setting. Admin → Android-app tags each upload **TDC Innsjekk** or **Smooth Print** (read from the APK).

- **TDC Innsjekk active**: Android browsers go to `/last-ned` and check in in the app.
- **Smooth Print active**, or **nothing active**: Android browsers keep the Smooth Print wizard in `/oppsett`, as before the app. It installs the active Smooth Print APK, or Brother's download when none is active. `/last-ned` goes straight on.

So to roll back, activate the Smooth Print APK (or deactivate the app). It takes effect on the next page load. Phones that already have the app keep working in it, without update prompts.

### Login handoff

The app has its own cookies; it cannot read the browser's. So that staff only log in once, **Åpne appen** carries the browser's login over:

1. On tap, the page asks `/api/app/handoff` for a one-time code (better-auth `oneTimeToken`: single use, 2 minutes, stored hashed, minted only by our server).
2. The `intent://` link opens the app on `/app-login?token=…&next=…`.
3. `/app-login` redeems the code, which sets the same session cookie in the app, and goes on to `next`. A spent or expired code goes to the normal login instead.

App and browser then share one session: logging out in one logs out both.

Opened the app some other way (home screen, or **Åpne** in Android's installer) and it asks for login? **Hent innlogging fra nettleseren** on the app's `/logg-inn` opens `/til-appen` in the phone's browser (`BrowserPlugin.java` picks the browser by package, so App Links do not send it straight back). A logged-in browser hands its login back the same way. The page /last-ned was about to open (e.g. a printer sticker) is kept in a cookie for 30 minutes, so setup still lands on that printer. Needs an app with the plugin (after 0.10).

## Updates

- Release builds tell the server their version in the user agent (`TDCInnsjekkApp/<versionCode> (<versionName>)`, set at build time from `ANDROID_VERSION_CODE` / `ANDROID_VERSION_NAME`). Local builds send no version and are never asked to update.
- **Innstillinger** shows the installed version in the app, and **Oppdater til versjon …** when a newer one is uploaded.
- The latest version is read from the active APK under Admin → Android-app (`AndroidManifest.xml` inside the APK, `src/lib/apk-manifest.ts`). Nothing to type in when uploading.
- On a door page, an app older than that goes to `/last-ned`: **Oppdater appen** with **Oppdater** and **Ikke nå** (`src/lib/app-release.ts`, called from `requireDoorSession`). **Ikke nå** hides the prompt until a newer version is uploaded. An up-to-date app that opens `/last-ned` goes straight on.
- **Oppdater** downloads the APK inside the app with the login cookies (`AppUpdater.java`) and opens Android's installer. The first time, Android asks to allow installs from TDC Innsjekk. The update keeps login and the remembered printer.

## App Links

`https://innsjekk.trondheimdc.no` links (sticker QRs scanned with the phone camera, links in chat) open in the app when it is installed. `MainActivity` loads the link's path on the app's own server.

Android only trusts this when `/.well-known/assetlinks.json` lists the SHA-256 of the key the installed APK is signed with. Put the release key's fingerprint in `ANDROID_APP_CERT_SHA256` (`src/lib/android-app.ts`) and deploy. Until then, the links open in the browser; **Åpne appen** works either way. Debug and preview builds never get App Links.

## Release

### Signing key (once)

Every update must be signed with the same key, or Android refuses to install it over the old app (staff would have to uninstall first), and App Links stop matching. Make it once, keep the file and password in the password manager, and never commit it.

The key belongs to this app (`no.trondheimdc.innsjekk`), so its secrets live in this repo, not org-wide: another TrondheimDC app gets its own key, and a leaked key only affects one app. The certificate name is only a label inside the key; nobody sees it outside Play Store.

```bash
# Same password for keystore and key (PKCS12 keeps one). Do not use interactive
# `gh secret set` / keytool prompts — they hang without a TTY.
PASS=$(openssl rand -base64 24)
echo "Store this in the password manager, then clear the shell history line:"
echo "$PASS"

keytool -genkeypair -v -keystore innsjekk-release.jks -alias innsjekk \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=TDC Innsjekk, O=TrondheimDC" \
  -storepass "$PASS" -keypass "$PASS"

REPO=TrondheimDC/trondheimdc-innsjekk
base64 -w0 innsjekk-release.jks | gh secret set ANDROID_KEYSTORE_BASE64 --repo $REPO
printf '%s' "$PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo $REPO
printf '%s' "$PASS" | gh secret set ANDROID_KEY_PASSWORD --repo $REPO
gh secret set ANDROID_KEY_ALIAS --repo $REPO --body innsjekk

keytool -list -v -keystore innsjekk-release.jks -alias innsjekk -storepass "$PASS" | grep SHA256
# → put it in ANDROID_APP_CERT_SHA256 (src/lib/android-app.ts)
unset PASS
```

Run it outside the repo folder (or delete `innsjekk-release.jks` afterwards) so the key file never ends up in git.

### Build a version

Push a tag `android-v1.0.0`, or run **Actions → Android app** with a version. `.github/workflows/android.yml` builds a release APK signed with the key above, checks the signature, and attaches `tdc-innsjekk-<version>.apk` to a GitHub Release. Its run summary shows the signing fingerprint.

Then download the APK from the release and upload it under **Admin → Android-app**, and make it active. Phones get it from **Last ned appen**; installing over the old app keeps login and the remembered printer.

`versionCode` is `100 + run number`, so every CI build is newer than the last.

## Local build

Needs JDK 21 and the Android SDK (platform 36). `ANDROID_HOME` must point at the SDK.

```bash
pnpm android:build     # cap sync + gradlew assembleDebug
# → capacitor/android/app/build/outputs/apk/debug/app-debug.apk
```

Debug builds are signed with this machine's debug key: they will not install over a release build (uninstall first).

Launcher icons come from `src/app/icon1.svg`: run `pnpm build:android-icons` after changing it.

Point a build at another server (e.g. a preview deploy) with `CAP_SERVER_URL=https://… pnpm android:build`. Use HTTPS: the in-app QR camera needs a secure context.

## Not verified yet

- Printing to a real QL-820NWBc over SPP over a whole event: reconnects after sleep, two phones on one printer.
- Pairing straight from `connect` (no OS pair step) on older (Android ≤ 11) phones.
- App Links on a real phone, once the release key is in `assetlinks.json`.
