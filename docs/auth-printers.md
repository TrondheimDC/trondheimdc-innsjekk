# Auth & printere

Decided approach for gating TDC Innsjekk and auditing which printer checked people in.

Related: [TODO.md](./TODO.md), [MVP-verification.md](./MVP-verification.md).

## Goals

- **Admin** users manage printers, APK, CSV import, and admin accounts.
- **Printer** door accounts run day-of door work (scan / søk / confirm / print / check-in) only.
- Audit trail on `check_events` names the **printer**, not a shared PIN with no identity.
- Creating a printer also creates its door login (token + PIN). There is no separate «stasjon» entity.
- Stickers encode `PUBLIC_URL` (default `https://innsjekk.trondheimdc.no`) so preview builds still print production QRs. In-app scan ignores host.

## Stack

- **better-auth** — sessions, hashed credentials, admin plugin, Drizzle + LibSQL.
- Roles: `admin` | `printer`
- Printer id: `prt_` object id; the setup sticker links to it.
- Door login: long-lived QR token (`lgn_` object id) + 6-digit PIN.

## Roles & route access

| Role | Norwegian | Access |
|---|---|---|
| `admin` | Administrator | `/admin/*`, all admin APIs; also door routes |
| `printer` | Printer (dør) | `/`, `/sok`, `/deltaker/*`, `/oppsett`, `/koble`, attendee APIs, APK |

Admins sign in at `/auth/sign-in` (username + password). They do **not** need QR/PIN for day-of door work (`canAccessDoor` includes admin).

## Printer = door identity

One phone ↔ one printer ↔ one door login. The login is a better-auth shadow `user` (`role: printer`) linked via `user.printerId`.

| Field | Notes |
|---|---|
| Printer `name` | e.g. «Inngang A» — also the door user display name / audit actor |
| Setup QR | Front of the printer; name above the QR; `/oppsett?printer=prt_…` (older stickers: UUID id, or MAC/serial/model inline) |
| Login QR | Underside of the printer; «Logg inn · {name}» above the QR (`loginStickerText`); `/logg-inn/lgn_…` → `/logg-inn?token=lgn_…` (older stickers: the query form, or `prt_…`, same token) |
| PIN | 6 digits; password for the door user. **Rotér PIN** without changing the QR |
| Token | `lgn_` + uppercase nanoid body. Drizzle `objectId("username", "lgn")` stores body only; `prt_` is still accepted. Long-lived; **Ny innloggings-QR** when reprinting |

## Why two stickers

Decided 2026-10-11. Printer and door login are one thing in the database, but each printer still gets two stickers:

- **Front, setup QR** (`prt_…`): front and center, easy to spot, so anyone can get started. It holds no secret.
- **Underneath, login QR** (`lgn_…`): the username. Logging in should be easy, so it is a scan and a 6-digit PIN, nothing harder.

A 6-digit PIN is weak on its own. What protects the login is that the username only exists on the sticker under the printer, plus the sign-in rate limit and the validity window. If we see abuse, **Ny innloggings-QR** gives the printer a new username without registering the printer again; **Rotér PIN** changes the PIN without reprinting anything.

Security is about acceptable risk. Putting the username on the front, in plain view, would weaken this. Two stickers cost little: a phone that scanned the front sticker first is sent back there after login (`next`), so staff are not asked to scan it again.

## Sign-in

- Door `/logg-inn`: skann QR or paste code/URL, then PIN.
- Endpoint: `POST /api/auth/sign-in/printer` — under `/sign-in` so better-auth's default sign-in rate limit (3 per 10 s) applies.
- Rotate PIN alone for a new event; rotate token only when reprinting the under-printer sticker.

## Admin UX

`/admin/printers` only — enroll creates hardware row + door login. Secrets: Vis PIN og innloggings-QR, Rotér PIN, Ny innloggings-QR, Deaktiver.
