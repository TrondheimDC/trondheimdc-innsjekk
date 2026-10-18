# Conference test plan

Dress rehearsal on **production** (`https://innsjekk.trondheimdc.no`) with the real printers, real phones and the real attendee list. Every printer goes through the same steps it will on the day. When the run is over, the printers and phones are ready for the door.

Earlier hardware checks: [MVP-verification.md](./MVP-verification.md). Since then we added the Android app, the login handoff between browser and app, `prt_` / `lgn_` ids on the stickers, door corrections, tickets without a name, and USB printing from PC/Mac. This plan covers all of it.

Legend: ☐ to do · ☑ done · — skipped (write why). Write the result and who tested in **Notes**; bugs go to [TODO.md](./TODO.md).

**Platforms.** iPhone = Safari + Smooth Print. Android = the TDC Innsjekk app (prints over Bluetooth, no Smooth Print). Test Android with more than one browser where we can: Chrome, Samsung Internet, Firefox.

---

## Part A — Prep (one person, before the session)

Nothing here needs the other staff.

### A1. Deploy and app release

| # | Task | Done | Notes |
|---|---|---|---|
| A1.1 | Push `master` and wait for the deploy (prefix change `prt_` / `lgn_`, fingerprint, login handoff) | ☐ | Must be live **before** any printer is registered, or it gets a UUID id |
| A1.2 | `https://innsjekk.trondheimdc.no/.well-known/assetlinks.json` lists `4E:90:49:…:B8:0C` | ☐ | |
| A1.3 | 0.10 uploaded and active under Admin → Android-app; test print from the app works | ☑ | 2026-10-10 |
| A1.4 | Run **Actions → Android app** for the next version (has «Hent innlogging fra nettleseren»). Do **not** upload it yet | ☐ | Uploading it is test U1, so the update flow gets tested on 0.10 phones |
| A1.5 | Smooth Print APK still uploaded (inactive) for rollback | ☐ | Drill D10 |
| A1.6 | Your Android phone: Settings → Apps → TDC Innsjekk → Open by default → `innsjekk.trondheimdc.no` is verified | ☐ | Reinstall the app if it was installed before A1.2 |

### A2. Accounts and data

| # | Task | Done | Notes |
|---|---|---|---|
| A2.1 | Sign in as admin on prod (`/auth/sign-in`) | ☐ | |
| A2.2 | Admin users for anyone else who needs admin (`/admin/brukere`) | ☐ | Door staff do not need accounts; they use the printer's QR + PIN |
| A2.3 | Import the latest totalrapport CSV (Admin → Deltakere). Counts and skipped rows look right | ☐ | Re-import keeps check-ins |
| A2.4 | Pick **test tickets**: your own and colleagues', one without a name, one cancelled. Write the barcodes down | ☐ | Test check-ins are real `check_events`; check them out afterwards (E1) |

### A3. Register the printers

Decide the names first («Inngang A», «Inngang B», …). The name is on both stickers, the door login and the audit log.

For **each** printer, in `/admin/printers/ny`:

| # | Task | Done | Notes |
|---|---|---|---|
| A3.1 | Read the Bluetooth address: Menu → Bluetooth → Bluetooth Status → Address | ☐ | Victor: `08:F9:7E:CB:6C:64` |
| A3.2 | Scan the serial barcode inside the printer (under the roll) | ☐ | Victor: `E82696C6G972070` |
| A3.3 | Save. Copy the **PIN** to the password manager / staff sheet | ☐ | Also under **Vis PIN og innloggings-QR** |
| A3.4 | Validity window empty, or covering setup day **and** the conference | ☐ | Outside it the door login is refused |
| A3.5 | The setup link for the printer has `printer=prt_…` (not a UUID) | ☐ | If not, A1.1 is not live: delete and register again |

Staff sheet: printer · MAC · serial · PIN · phone · person.

### A4. Stickers

Two per printer: **setup QR** on the front, **login QR** («Logg inn · {name}») underneath. Why two: [auth-printers.md → Why two stickers](./auth-printers.md#why-two-stickers).

| # | Task | Done | Notes |
|---|---|---|---|
| A4.1 | Print both for one printer (from a phone, or Chrome/Edge on a PC over USB) | ☐ | |
| A4.2 | Scan both with a phone camera: setup → `/oppsett/prt_…`, login → `/logg-inn/lgn_…` (each redirects to its page) | ☐ | A **USB-printed** sticker has never been scanned on hardware (open TODO). Check it here before printing the rest that way |
| A4.3 | Print and stick the rest, **one printer at a time**, checking the name | ☐ | |

### A5. Hardware and supplies

| # | Task | Done | Notes |
|---|---|---|---|
| A5.1 | DK-11208 rolls: one per printer + spares | ☐ | Stickers use the same rolls |
| A5.2 | Power at every door position (cords, strips) | ☐ | |
| A5.3 | Phone list: owner, iOS/Android, browser, which printer. One phone per printer | ☐ | Chargers / power banks |
| A5.4 | Venue Wi-Fi / 4G: the site loads fast at the door | ☐ | Login and check-in need the network; printing is Bluetooth |
| A5.5 | PC/Mac at the door? USB-B cable, Chrome or Edge, Zadig on Windows | ☐ | Linux (udev) not verified on hardware |

### A6. Dry run

Run H1–H4, B and C alone on one printer with one phone. Fix what breaks before the session.

---

## Part H — Login and the Android app

The new flows. Start each test **logged out** in both the browser and the app (logging out in one logs out both, since they share one session), unless the test says otherwise. "Browser" means the phone's default browser.

| # | Steps | Expected | Android | Notes |
|---|---|---|---|---|
| H1 | App **not installed**. Phone camera on the **setup** sticker → browser opens `/logg-inn` → **Skann QR** on the login sticker → PIN | Lands on `/last-ned` (Last ned appen) | ☐ | |
| H2 | Continue H1: **Last ned appen** → allow installs → install. **Go back to the browser**, tap **Åpne appen** | App opens logged in, on `/oppsett` for **that** printer | ☐ | |
| H3 | Like H1–H2, but after installing press **Åpne** in Android's installer | App opens on the login screen, with **Hent innlogging fra nettleseren** | ☐ | Needs the app from A1.4 (0.10 does not have it, see H8) |
| H4 | Continue H3: tap **Hent innlogging fra nettleseren** | Browser opens «Tilbake til appen», then the app opens logged in on `/oppsett` for that printer. If nothing happens by itself, tap **Åpne appen** | ☐ | Write down whether it opened by itself |
| H5 | H3–H4 with another default browser (Samsung Internet, Firefox, …) | Same as H4; the right browser opens, not the app | ☐ | Browser: |
| H6 | App installed, browser **logged out**: in the app tap **Hent innlogging fra nettleseren** | Browser shows «Ikke logget inn her»; **Åpne appen** goes back to the login screen in the app | ☐ | |
| H7 | Wait more than 30 minutes between H1 and H4 | App opens logged in on the start page (not the printer): scan the setup sticker again | ☐ | The remembered page lasts 30 min |
| H8 | App 0.10 (before U1): tap **Hent innlogging fra nettleseren** | The button is there (the server draws it), but tapping it says «Oppdater appen for å hente innloggingen fra nettleseren.» | ☐ | Do this before U1 |
| H9 | App installed, logged out: phone camera on the **setup** sticker | Opens in the **app** (not the browser), asks for login, then `/oppsett` for that printer | ☐ | Needs A1.2 / A1.6 |
| H10 | In the app: log in with **Skann QR** on the login sticker + PIN | Logged in; after a setup sticker scan, back on that printer's setup | ☐ | |
| H11 | Logged in in both, then log out in the app | The browser is logged out too | ☐ | |
| H12 | Logged-in browser on `/last-ned`: wait 3 minutes, then **Åpne appen** | Still works (the code is made on tap, not on page load) | ☐ | |

iPhone has no app: login is Safari + PIN (B1).

### U. App update (0.10 → next)

| # | Steps | Expected | Done | Notes |
|---|---|---|---|---|
| U1 | Upload the APK from A1.4 under Admin → Android-app and make it active | Shows as TDC Innsjekk with the new version | ☐ | |
| U2 | On a phone with 0.10, open a door page | «Oppdater appen» with **Oppdater** / **Ikke nå** | ☐ | |
| U3 | **Ikke nå** | Carries on; not asked again until a newer upload | ☐ | One phone only |
| U4 | **Oppdater** → allow installs from TDC Innsjekk (first time) → install | Still logged in, still remembers the printer; Innstillinger shows the new version | ☐ | |
| U5 | After the update, run H3–H4 on that phone | Works (the plugin is there now) | ☐ | |

---

## Part B — Set up every printer (group)

Pair each person with a printer and their own phone, so everyone has done it once before the day.

### B1. Log in

| # | Steps | Expected | iOS | Android | Notes |
|---|---|---|---|---|---|
| B1.1 | Camera on the **login** sticker → PIN | Logged in | ☐ | ☐ | Android: then `/last-ned` / the app (Part H) |
| B1.2 | Wrong PIN a few times | «Ugyldig QR eller PIN», then «For mange forsøk…»; no crash | ☐ | ☐ | |
| B1.3 | Logged out, scan the **setup** sticker first, then log in with **Skann QR** on the page | Back on `/oppsett` for that printer after the PIN | ☐ | ☐ | |
| B1.4 | Close the browser / app, open again | Still logged in | ☐ | ☐ | |
| B1.5 | Type the code by hand (**Skriv inn kode manuelt**), with and without `lgn_` | Accepted | ☐ | ☐ | One phone is enough |

### B2. Connect the phone to its printer (`/oppsett`)

| # | Steps | Expected | iOS (Smooth Print) | Android (app) | Notes |
|---|---|---|---|---|---|
| B2.1 | Install step | iOS: App Store Smooth Print | ☐ | — | |
| B2.2 | Printer Bluetooth on | The illustration matches the printer | ☐ | ☐ | |
| B2.3 | iOS: OS Bluetooth pair | Paired before connect | ☐ | — | |
| B2.4 | **Skann QR** on the **setup** sticker → connect | Connected. Android shows its pairing code the first time | ☐ | ☐ | |
| B2.5 | Test print | Correct label on DK-11208 | ☐ | ☐ | |
| B2.6 | One printer per platform: **Manuelt oppsett** instead of the QR | Works | ☐ | ☐ | So someone has seen the fallback |
| B2.7 | Open the app again later (Android) | Reconnects to the remembered printer by itself | — | ☐ | |

---

## Part C — The door (group)

Each pair on its own printer, with the tickets from A2.4.

| # | Steps | Expected | iOS | Android | Notes |
|---|---|---|---|---|---|
| C1 | Scan a ticket QR → confirm → print | Right attendee; badge prints; checked in | ☐ | ☐ | |
| C2 | Search by name, then by company | Finds them | ☐ | ☐ | |
| C3 | Ticket without a name: scan → type the name | «Bedrift» suggested as company; badge prints | ☐ | ☐ | |
| C4 | Fix name / company / title at the door → print | Badge shows the fix; the search shows it too | ☐ | ☐ | |
| C5 | Print the same attendee again | Reprint works | ☐ | ☐ | |
| C6 | **Sjekk ut** | Check-in undone. Do it for every test check-in | ☐ | ☐ | |
| C7 | Scan a cancelled ticket | Clearly not found / not valid | ☐ | ☐ | |
| C8 | Torch in a dark spot; switch camera | Works | ☐ | ☐ | |
| C9 | Time scan → badge in hand, 5 tickets | Write the times down | ☐ | ☐ | |
| C10 | Two doors check in at the same time | The checked-in count on search adds up | ☐ | ☐ | |

---

## Part D — Things that go wrong

| # | Drill | Expected | Done | Notes |
|---|---|---|---|---|
| D1 | Printer off / out of range, then print | Clear error; works once the printer is back (the app reconnects) | ☐ | |
| D2 | Roll runs out; change it | Clear error; reprint works | ☐ | |
| D3 | Phone locked / app in background 10 min, then scan + print | Still logged in and connected | ☐ | |
| D4 | Restart the phone | Log in and print without redoing setup | ☐ | |
| D5 | A phone dies: give its printer another phone | Login sticker + setup sticker is enough | ☐ | |
| D6 | Deny camera permission | Search still works | ☐ | |
| D7 | **Rotér PIN** on one printer | New PIN works, old one does not; sticker unchanged | ☐ | |
| D8 | **Ny innloggings-QR** on one printer | Old login sticker stops working; reprint only the bottom sticker, the front one stays | ☐ | |
| D9 | **Deaktiver** a printer, then **Aktiver** | That door is logged out, then can log in again | ☐ | |
| D10 | Rollback: activate the Smooth Print APK | Android browsers get the Smooth Print wizard; phones with the app keep working. Switch back | ☐ | |
| D11 | Re-import the CSV while people are checked in | Check-ins are still there | ☐ | |
| D12 | Innstillinger → admin, and back to check-in from the sidebar | Works | ☐ | |

---

## Part E — Wrap up

| # | Task | Done |
|---|---|---|
| E1 | Every test check-in checked out (search with **Vis innsjekkede**) | ☐ |
| E2 | Every printer: both stickers, a full roll, a phone that has printed on it | ☐ |
| E3 | Staff sheet complete: printer · phone · person · PIN | ☐ |
| E4 | Bugs and rough spots in [TODO.md](./TODO.md) | ☐ |
| E5 | Morning plan: re-import the CSV, power on the printers, one test print per door | ☐ |
