# Remaining work

Backlog for TDC Innsjekk. Check items off as they land.

**MVP done?** Use the hardware QA checklist in [MVP-verification.md](./MVP-verification.md) — onboarding on iOS and Android, day-of scan/print, admin/deploy, and sign-off.

Brother docs hub: [Smooth Print HTML documentation](https://support.brother.com/g/s/es/htmldoc/smoothprint/) — also summarized in [RESEARCH.md](../RESEARCH.md).

## High priority

### Android app: release signing

The app ([android-app.md](./android-app.md)) needs one release key before it can ship as a release build and before `innsjekk.trondheimdc.no` links open in the app. Steps and commands: [android-app.md → Signing key (once)](./android-app.md#signing-key-once).

- [x] Create `innsjekk-release.jks` (`CN=TDC Innsjekk, O=TrondheimDC`), keep file + password in the password manager
- [x] Repo secrets on `TrondheimDC/trondheimdc-checkin`: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`
- [x] Put the SHA-256 fingerprint in `ANDROID_APP_CERT_SHA256` (`src/lib/android-app.ts`) and deploy
- [ ] Run **Actions → Android app**, upload the APK under Admin → Android-app, make it active
- [ ] On a phone: install, then check Settings → Apps → TDC Innsjekk → Open by default lists `innsjekk.trondheimdc.no` as verified

### Auto-pair via Smooth Print URL schemes + QR

**Goal:** scan a QR (or open a link) that runs Smooth Print find/connect so the phone attaches to the right QL without the long manual Bluetooth + “I see it in the app” dance.

Docs:

- [Find printer](https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/find_printer/)
- [Connect printer](https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/connect_printer/)
- [Printer status](https://support.brother.com/g/s/es/htmldoc/smoothprint/reference/printer_status/) (useful once connected)

Tasks:

- [x] Spike UI via `/koble` → now redirects into `/oppsett` (MAC/serial/model → tap → `brotherwebprint://connect`)
- [x] Setup QR payload is https `/oppsett?path=qr&…` (also accepts legacy `/koble?…`); admin stickers print that link
- [x] `/oppsett` happy path: Android — install → printer BT on → Skann QR → `connect` → test print. iOS — same prelude, then **OS Bluetooth pair** (MFi) before `connect` → test print. Manual fallback from scan: OS pair → select in Smooth Print → test. See [RESEARCH.md → Setup order](../RESEARCH.md#setup-order--decision-2026-09-27-revised-same-day)
- [x] Fix: sticker QR deep link (`path=qr&step=connect`) skipped install/Bluetooth-on prelude on a fresh phone — now shown once, then a primed session resumes instantly on refresh/deeplink (`src/app/oppsett/setup-flow.tsx`)
- [x] Android: install with Ferdig (do not open the app); force-close Smooth Print only before print (overlay dialog). Connect opens the app when needed.
- [x] Connect URL scheme checked against Brother docs — `buildConnectQuery` matches (`connecttype`, `connectaddress`, `serialnum`, `model`); `connectcallback` omitted (new-tab problem)
- [x] Android: sticker / in-app `brotherwebprint://connect` verified on hardware (happy path without OS-pair-first).
- [x] **Android onboarding grade-A** (2026-09-27): install → Ferdig (don’t open) → verify BT icon → Skann QR → connect (permissions/terms/BT on cold start) → returns to browser → force-close → test print overlay. Manual fallback also works.
- [x] **iOS onboarding verified** (2026-09-28): App Store install → verify BT → **OS Bluetooth pair required before connect** (MFi) → Skann QR / sticker `connect` → test print. Wizard inserts the pair step on the QR path; documented in [RESEARCH.md](../RESEARCH.md) and `/oppsett`.
- [x] iOS connect without prior OS pair fails (Failure / Not connected) — expected; pair step is on the happy path, not only the manual fallback
- [x] `brotherwebprint://print` had no return-to-webapp callback — wired up `successCallback`/`failureCallback` (https URLs back to `/deltaker/[id]`) in `src/lib/print-url.ts` + `src/components/print-button.tsx`; confirmed on iOS that it does return to Safari and appends its own `errorCode=SUCCESS`
- [x] Callback opened a **new Safari tab per print** on iOS (confirmed on hardware; a fragment-based callback is not an option — Smooth Print percent-encodes `#` into the path and concatenates without a separator). Mitigated: `print-button.tsx` now pre-sets the tab's address bar to the exact success-callback shape before firing the print (iOS only), so a successful print should match and reuse the tab; failure still opens a new tab
- [x] Retest on iOS: tab-reuse pre-set works — Safari reuses the tab. But it still does a **full reload** (not caused by our own `replaceState` calls, confirmed — see [RESEARCH.md](../RESEARCH.md)), which flashes the whole app + attendee loading skeletons on every print
- [x] Android badge print: omit `successCallback`/`failureCallback` — Chrome always opened a new tab per callback (worse than Smooth Print's dialog on the same tab). Dialog only works if Smooth Print is **not** already in the background; otherwise print switches into the app. iOS keeps the callback + address-bar pre-set. See [RESEARCH.md → Android omit](../RESEARCH.md#android-omit-print-callbacks--decision-2026-09-27)
- [x] Faster turnaround idea (navigate to `/` via `visibilitychange` as soon as the tab regains focus after Smooth Print, instead of waiting on the callback's reload): tried, found a bug before it ever reached hardware (flag never clears on a successful print since a reload never fires `visibilitychange`, so the next unrelated app-switch would misfire a navigation), reverted — see [RESEARCH.md](../RESEARCH.md). Worth another idea for turnaround speed, but not this one as-is
- [x] Attendee list at 900 people (fine at ~700 on real use, so no cap or pagination): decide whether `/sok` should show everyone by default when the search box is empty (currently only searches once you type). Full virtualization is real integration work, not cheap — `cmdk`'s keyboard nav (arrow keys / Home / End) queries the live DOM for all rendered items, so a windowed subset breaks it unless carefully coordinated. Cheaper path: cap the default list (e.g. first ~150) or paginate/"load more", not true virtualization; needs a persisted setting too if we keep the current empty-state (`useLocalFlag`, same pattern as "Vis innsjekkede")

## Before the conference (MVP polish)

### Host Smooth Print APK

- [x] Admin inventory at `/admin/smooth-print`: upload APK, activate/deactivate (one active), delete
- [x] Store files under `data/apks/` (gitignored); stream active via `GET /api/smooth-print/apk`
- [x] `/oppsett` uses hosted APK when one is active; otherwise Brother agreement page
- [x] Conference APK uploaded and active (staff setup day)

### Auth & printere

**Decided.** Full design: [auth-printers.md](./auth-printers.md).

better-auth + better-auth-ui. Roles: `admin` | `printer`. Creating a printer also creates door login (`lgn_` token + PIN). Stickers use `PUBLIC_URL` (default production). `/oppsett` / `/koble` / APK require door session. No nginx basic auth; Checkin is not the staff IdP.

- [x] Add better-auth (Drizzle/LibSQL), admin plugin, roles `admin` / `printer`
- [x] User fields: `validFrom`, `validTo`, optional `printerId`; long `session.expiresIn` + enforce validity window
- [x] Middleware / route gates: door + admin APIs require session; `/oppsett`, `/koble`, active APK gated as door
- [x] Install better-auth-ui (shadcn): `@better-auth-ui/auth`, `admin`, `user-button` + Sonner; Norwegian localization
- [x] Admin sign-in (`/auth/sign-in`) + door `/logg-inn` (PIN + magic token); better-auth-ui SignIn + username for admin
- [x] Admin `/admin/brukere` via better-auth-ui; `UserButton` in admin shell
- [x] `/admin/printers` inventory + `/admin/printers/ny` enroll (hardware + door login)
- [x] Setup sticker + login sticker; Rotér PIN / Ny innloggings-QR
- [x] Door `/logg-inn`: token + PIN; Vis PIN in admin
- [x] Stamp `check_events` with acting printer/user for audit
- [x] Super-admin seeded from `ADMIN_USERNAME` / `ADMIN_PASSWORD` on boot; env in `.env.example` / README
- [x] Protect CSV import and other admin mutations behind admin role
- [x] `PUBLIC_URL` for sticker origins (defaults to production, including localhost)

### Admin CSV upload

- [x] Admin UI to upload a Checkin totalrapport CSV (same rules as `pnpm import:attendees`)
- [x] Printer inventory at `/admin/printers`: name, Bluetooth MAC, serial, model
- [x] Enroll flow with illustrations, sticker preview, and print of a DK-11208 label (name above QR → `/oppsett?path=qr`)
- [x] Confirm the generated `printer.lbx` QR actually prints on the QL (template is hand-built, not from P-touch Editor)
- [x] Guide illustrations share one SVG kit (`src/components/illustrations`) drawn after the real QL-820NWBc: `/oppsett` Bluetooth, pair, scan (sticker on the front); `/logg-inn` (underside → printer); enroll + empty inventory
- [x] Login sticker says «Logg inn · {name}» so it can’t be mixed up with the setup sticker (bare name). Stickers printed before this still work — reprint only if you want the new text (same token)
- [x] `/oppsett` confirm step (`step=confirm`, manual path) uses real Smooth Print screenshots
- [x] Replace attendee list via API; show import counts / skipped rows
- [x] Keep CLI import as a fallback ([checkin-totalrapport.md](./checkin-totalrapport.md))

### Speakers, crew and volunteers (CSV)

Speakers, crew and volunteers are not all in Checkin, and we don't want to put them there. Import them from our own CSV next to the Checkin attendees.

- [ ] Decide the CSV columns (at least name, company/role, and which group: speaker / crew / volunteer) and whether the badge shows the group
- [ ] Keep it separate from the totalrapport import: today a totalrapport import soft-deletes everyone missing from the file, so a second list must not wipe the Checkin attendees (and the reverse)
- [ ] They have no Checkin ticket QR: decide whether they are found by name search only, or get our own id (and a QR somewhere)
- [ ] Admin upload with the same import result counts as the totalrapport; CLI fallback like `pnpm import:attendees`

### Day-of readiness

- [x] Confirm a **real ticket QR** payload matches the totalrapport `Barcode` column (scan → correct attendee)
- [x] Full happy path on **Android** (scan → confirm → print)
- [x] Smoke-test print on **iOS Safari** (2026-09-28; badge print OK — see [RESEARCH.md](../RESEARCH.md))
- [x] Re-import totalrapport near the event (and morning-of) so late signups / cancellations are in (routine task)
- [x] Phone↔printer topology: **one phone per printer** (agreed; Brother does not document whether a second phone can steal Bluetooth while the first is still paired)
- [x] **Deploy:** HTTPS + base path / nginx on the conference host (camera + custom schemes need secure context; no basic auth in front — app sessions). Live; nginx `client_max_body_size` raised to 300m for APK uploads.

## Beyond MVP

### Live Checkin integration

**Postponed to next year's TDC.** This year runs on the totalrapport CSV + re-import. Decide architecture before coding.

Started on the local branch `feature/events-and-integrations` (not pushed): `/admin/arrangementer` (one attendee list per event, one active), `/admin/integrasjoner` (Checkin client id/secret, Synk/Live per integration, connection test via `allEvents`), door reads through `doorAttendees()`, and `check_events.synced_at` as an outbox for pushing check-ins back. Rebase it onto `master` before picking this up.

Checkin's developer docs: [Developer Documentation](https://checkinno.atlassian.net/wiki/external/NTlmNmFhYjk5OWUwNGU4OTk5ZTk4ZjExOTYxMWYzNjU). What matters for us:

- GraphQL at `https://api.checkin.no/graphql` (explorer: `https://api.checkin.no/graphiql/`). API keys are set up under the organization's API integration page in Checkin (admin access).
- Attendees: `allEventOrderUsers(customerId, length, offset, reportFilters)` → `crm { name firstName lastName }`, `ticket { id name type }`, `propertyValues { propertyKey value }` (company is `systemFieldCompanyName`, job title `systemFieldWorkTitle`). Filter on `EVENT_ID`; incremental sync with `CREATED_AT GREATER_THAN_OR_EQUAL <last sync>`; leave out cancelled with `CANCELLED_AT IS_EMPTY`. The docs do not show a barcode field — find it in the explorer before dropping CSV (the branch notes `findEventTicketInformationByBarcode(barcode)` for live lookup).
- Webhooks (`app.checkin.no/customer/<id>/integrations/provider-webhooks`): Event, Ticket, Order (`event-order-created`, `EventOrder` payload with `users[]`), and Order user — fires on ticket scan / check-in. An incremental `CREATED_AT` filter misses edits and cancellations, so pair it with the Order webhook or a full re-pull.

**Open decision — how we talk to Checkin:**

| Mode | Summary |
|---|---|
| Live API | Door actions hit Checkin (or a proxy) each time — freshest, but network/Checkin become hard dependencies |
| Periodic sync + forced sync | Local DB remains source of truth for scan/print; sync on an interval; staff can force “Sync now” — closer to today’s CSV model, survives brief outages, with a staleness window |
| Hybrid | e.g. local lookup/print + live mark-checked-in (or the reverse) |

Pros/cons and sign-off context: [MVP-verification.md → Checkin integration](./MVP-verification.md#checkin-integration).

Tasks:

- [ ] Decide mode (live API vs periodic + forced sync vs hybrid vs CSV-only for this conference)
- [ ] Pull attendees from Checkin API instead of (or in addition to) CSV upload
- [ ] Map barcode / ticket QR to the same id the scanner expects
- [ ] Optional: sync check-in events back to Checkin if that matters for the door/ops workflow
- [ ] Fall back to CSV/admin upload (or last good sync) if the API is down on the day

`tdc-sales` already talks to Checkin’s GraphQL for sales; reuse patterns where they fit. For badge print, barcode must match scan text — confirm that before dropping CSV.

### Desktop printing (WebUSB)

**Exploratory, but direction is set:** land on **WebUSB** from Chromium. Network print agents, TCP `:9100` relays, and OS-driver/`window.print()` paths are too much pain for the gain — park them.

Phone MVP stays on Smooth Print. Desktop skips Smooth Print / LBX and talks to the QL over USB from the browser.

**Hardware (QL-820NWBc):**

- **USB host** (scanner on the printer): **no** on NWBc — ticket scan on desktop is PC webcam / USB HID wedge / paste.
- **USB device** (Type-B → PC): **yes** — this is the WebUSB path.

**Scope we accept:**

| | |
|---|---|
| OS | macOS / Windows / Linux (wherever Chrome/Edge + WebUSB work with the QL) |
| Browsers | Chromium-based only today ([Can I use WebUSB](https://caniuse.com/webusb)) — not Firefox/Safari |
| API | [`navigator.usb`](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API) + Brother raster encode (e.g. [`@thermal-label/brother-ql-web`](https://thermal-label.github.io/brother-ql/web)) |
| Not doing | Local print agent, server→`:9100`, Web Serial/BT, system print dialog |

Secure context + user gesture for the device picker. Confirm **DK-11208** media id and layout vs phone `badge.lbx`.

**Separate setup flow** (do not overload phone `/oppsett`):

- e.g. `/oppsett/desktop` — feature-detect `"usb" in navigator`; `requestDevice` → test print → remember via `getDevices()`
- Unsupported browser copy: **«Bruk en nettleser som støtter WebUSB»** — note that only Chromium-based browsers do today; link [caniuse.com/webusb](https://caniuse.com/webusb)
- Day-of print uses the open WebUSB session; phones keep Smooth Print

**UI:** phone-first today — likely need a light desktop mode (wider search, keyboard, non-camera ticket input). Decide during spike.

Tasks:

- [x] Canvas badge renderer from the LBX layout (`src/lib/badge-render.ts`) + live preview in `/admin/testutskrift`
- [x] WebUSB connection store (`src/lib/usb-printer.ts`): picker, silent reconnect via `getDevices()`, status preflight, Norwegian errors
- [x] `/oppsett` on PC/Mac → USB wizard (`usb` → `driver` (Windows/Linux only) → `connect` → `test-print`)
- [x] Wire attendee confirm → WebUSB print (`PrintButton`); check-in only after the printer checks out; phones keep Smooth Print
- [x] Document Chrome/Edge-only, drivers and library gaps in [RESEARCH.md](../RESEARCH.md#desktop-printing-webusb)
- [x] **Hardware:** print one badge from Chrome on Mac — lands on the label (margin pins 12/295), same way up as phone, font looks right
- [x] **Hardware:** Mac and Windows (Zadig → WinUSB) connect
- [ ] **Hardware:** Linux (udev) connect
- [x] Printer stickers (`admin/sticker.tsx`) over USB — setup + login QR drawn in the browser (`renderSticker`)
- [ ] **Hardware:** scan a USB-printed sticker QR with a phone

### Check-in dashboard and replay

See and replay the day afterwards: how fast everyone got checked in, and how much attendee info had to be fixed at the door. A check-in counts as a printed label.

- [x] Admin → Dashboard (`/admin/dashboard`, the admin start page): pick a day or range (`?fra=&til=`, defaults to the latest check-in day), refreshes every 30 s while the range includes today
- [x] Chart of checked-in attendees over time (cumulative and per-interval: per minute / 5 / 15 / 60 minutes), built from `check_events` timestamps
- [ ] Replay the day: scrub or play a timeline and watch the count build up
- [x] Key numbers: first and last check-in, busiest minute and quarter, time to reach 50 / 90 %, share of attendees checked in
- [x] Count each attendee once: the `in` that still stands, leaving out check-ins that were later undone (`out`)
- [x] Door edits from `correct` events (not `attendees.correctedAt`, which only shows who is corrected right now): number of edits, attendees edited, which fields changed (`detail.from` / `detail.to`), and missing names filled in (`from.name` is null) counted separately; plus Manuelle and undone check-ins
- [x] Breakdown per printer (the door login's printer; admins by name)
- [x] Reprints: each badge sent is a `print` event (`reprint` when it had been printed already); Dashboard → «Skrevet ut på nytt» and per printer. Smooth Print counts as sent, not confirmed printed
- [ ] Per-day chart for ranges over several days (today the finest is per hour, mostly empty overnight)

### Own P-touch / template editor

- [ ] Build (or adopt) a **custom template editor** so we are not dependent on Brother P-touch Editor on Windows for badge layout changes
- [ ] Export / maintain `.lbx` (or an equivalent Smooth Print understands) with named objects `NAME` / `LINE2` (or configurable)
- [ ] Keep a path back to hand-edited LBX for emergencies

### More Smooth Print schemes (after auto-pair spike)

- [ ] Use **printer status** before print / on errors once connect works
- [ ] Wire other useful schemes into print recovery
- [ ] Document which schemes work from Safari / Chrome with a user gesture

Supported platforms (for staff phones): iOS 14.1+, Android 8.0+; Bluetooth Classic (MFi on iOS) and Wi-Fi — see [RESEARCH.md](../RESEARCH.md).

### Postponed (not this conference)

- [ ] Compare **`fileattach` (base64)** vs **`filename=<https://…/badge.lbx>`** on iOS and Android — reliability, speed, template updates ([RESEARCH.md](../RESEARCH.md)). Current `fileattach` path is fine for day-of.

## Nice to have

### Rename `master` → `main`

The other TrondheimDC repos (trondheimdc.no, regnskap, utlegg, forening) use `main`; this one is the odd one out. Do it after the conference, not while day-of deploys depend on it.

- [ ] Rename the default branch on GitHub (Settings → Branches), then locally: `git branch -m master main && git fetch origin && git branch -u origin/main main && git remote set-head origin -a`
- [ ] `.github/workflows/cd.yml` and `pr.yml`: `branches: ["master"]` → `["main"]` (and the comment at the top of `cd.yml`)
- [ ] `docs/deploy.md` and `docs/test-plan.md`: replace the references to `master`

### PWA

- [ ] Decide whether PWA / “Add to Home Screen” is worth it for door staff (install prompt, offline shell, icon, full-screen). Weigh iOS Safari limits vs Android, and whether a normal bookmark is enough for a two-day conference.

### Other

- [ ] Clearer empty/error states when Smooth Print is missing on iOS (Android already has intent fallback to `/oppsett`)
- [ ] Say why staff landed on the install step when Smooth Print is missing on Android: add a flag to the intent fallback URL (e.g. `?ikke-installert=1`) and show «Smooth Print er ikke installert» above the install step in `/oppsett`. A web page cannot detect installed apps, so the fallback is the only signal. Could reuse the same banner for the iOS «Skjedde det ingenting?» hint
- [ ] Stats / simple ops view (checked-in count is already on search; maybe a dedicated board)
